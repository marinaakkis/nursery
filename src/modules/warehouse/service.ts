import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { fail, ok, type Result } from "@/lib/result";
import { plants } from "@/modules/catalog";
import { batches, demandFacts, writeOffs } from "./schema";

/** Транзакция drizzle. Резерв и возврат обязаны идти внутри чужой транзакции —
 *  той же, в которой создаётся или отменяется заказ. */
type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/** 🔶 Порог «мало осталось». В спеке числа нет; три штуки — то, при котором
 *  бейдж реально показывается на демо-данных и не висит на половине каталога. */
export const LOW_STOCK_THRESHOLD = 3;

export const plantStockSchema = z.object({ plantId: z.coerce.number().int().positive() });

export type Stock = { plantId: number; available: number; low: boolean };

export async function getStock(raw: unknown): Promise<Result<Stock>> {
  const parsed = plantStockSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("validation_failed", "Неверный идентификатор растения", parsed.error.issues);
  }
  const { plantId } = parsed.data;

  const [row] = await getDb()
    .select({ available: sql<number>`coalesce(sum(${batches.remaining}), 0)::int` })
    .from(batches)
    .where(eq(batches.plantId, plantId));

  const available = row?.available ?? 0;
  return ok({ plantId, available, low: available > 0 && available <= LOW_STOCK_THRESHOLD });
}

export const plantsStockSchema = z.object({
  /** Список идентификаторов. Из HTTP приходит строкой «1,2,3», от инструмента — массивом. */
  plantIds: z.preprocess(
    (value) =>
      typeof value === "string"
        ? value
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)
        : value,
    z.array(z.coerce.number().int().positive()).min(1).max(200),
  ),
});

/**
 * Остатки списком — одной выборкой вместо запроса на каждое растение.
 * Растение без единой партии в выборку не попадает, поэтому результат
 * достраивается нулями: сетка каталога обязана знать про «нет в наличии»
 * так же уверенно, как про «мало осталось».
 */
export async function getStockMany(raw: unknown): Promise<Result<Stock[]>> {
  const parsed = plantsStockSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("validation_failed", "Неверный список растений", parsed.error.issues);
  }
  const ids = [...new Set(parsed.data.plantIds)];

  const rows = await getDb()
    .select({
      plantId: batches.plantId,
      available: sql<number>`coalesce(sum(${batches.remaining}), 0)::int`,
    })
    .from(batches)
    .where(inArray(batches.plantId, ids))
    .groupBy(batches.plantId);

  const byPlant = new Map(rows.map((row) => [row.plantId, row.available]));

  return ok(
    ids.map((plantId) => {
      const available = byPlant.get(plantId) ?? 0;
      return { plantId, available, low: available > 0 && available <= LOW_STOCK_THRESHOLD };
    }),
  );
}

export type ReserveItem = { plantId: number; quantity: number };
export type ShortItem = { plantId: number; requested: number; available: number };

/** Партии одного растения в порядке «сначала старейшая», под блокировкой строк.
 *  Порядок обязан совпадать во всех операциях с партиями, иначе взаимная
 *  блокировка двух одновременных заказов — см. ADR-0002. */
async function lockOldestBatches(tx: Tx, plantId: number) {
  return tx
    .select({ id: batches.id, remaining: batches.remaining })
    .from(batches)
    .where(eq(batches.plantId, plantId))
    .orderBy(batches.receivedAt, batches.id)
    .for("update");
}

/**
 * Резервирует позиции заказа, снимая остаток со старейших партий.
 * Вызывается только внутри транзакции заказа: резерв без заказа существовать
 * не должен, поэтому наружу — ни роутом, ни инструментом — не выставляется.
 *
 * Возвращает список нехватки. Пустой список — резерв удался целиком.
 */
export async function reserve(
  tx: Tx,
  orderId: number,
  items: ReserveItem[],
): Promise<ShortItem[]> {
  const short: ShortItem[] = [];
  // Один и тот же порядок обхода растений у всех вызывающих: по plantId.
  const ordered = [...items].sort((a, b) => a.plantId - b.plantId);

  for (const item of ordered) {
    const rows = await lockOldestBatches(tx, item.plantId);
    const available = rows.reduce((sum, b) => sum + b.remaining, 0);

    if (available < item.quantity) {
      short.push({ plantId: item.plantId, requested: item.quantity, available });
      continue;
    }

    let left = item.quantity;
    for (const batch of rows) {
      if (left === 0) break;
      const take = Math.min(left, batch.remaining);
      if (take === 0) continue;

      await tx
        .update(batches)
        .set({ remaining: sql`${batches.remaining} - ${take}` })
        .where(eq(batches.id, batch.id));

      // Из какой партии сколько взято — без этой строки отмену некуда возвращать.
      await tx.execute(sql`
        insert into order_reservations (order_id, batch_id, quantity)
        values (${orderId}, ${batch.id}, ${take})
        on conflict (order_id, batch_id) do update
          set quantity = order_reservations.quantity + ${take}
      `);

      left -= take;
    }
  }

  return short;
}

/** Возвращает резерв заказа ровно в те партии, из которых он был взят. */
export async function release(tx: Tx, orderId: number): Promise<void> {
  const reservations = await tx.execute<{ batch_id: number; quantity: number }>(sql`
    select batch_id, quantity from order_reservations
    where order_id = ${orderId}
    order by batch_id
    for update
  `);

  for (const row of reservations) {
    await tx
      .update(batches)
      .set({ remaining: sql`${batches.remaining} + ${row.quantity}` })
      .where(eq(batches.id, row.batch_id));
  }

  await tx.execute(sql`delete from order_reservations where order_id = ${orderId}`);
}

/**
 * Факт неудовлетворённого спроса. Пишется ОТДЕЛЬНОЙ транзакцией, уже после
 * отката основной: внутри неё он откатился бы вместе с несостоявшимся заказом,
 * и план закупок никогда бы его не увидел — ADR-0002.
 */
export async function recordRejectedDemand(items: ShortItem[]): Promise<void> {
  if (items.length === 0) return;
  await getDb()
    .insert(demandFacts)
    .values(items.map((i) => ({ plantId: i.plantId, quantity: i.requested, kind: "rejected_no_stock" as const })));
}

/** Проданное количество — для плана закупок. Пишется в транзакции заказа. */
export async function recordSoldDemand(tx: Tx, items: ReserveItem[]): Promise<void> {
  if (items.length === 0) return;
  await tx
    .insert(demandFacts)
    .values(items.map((i) => ({ plantId: i.plantId, quantity: i.quantity, kind: "sold" as const })));
}

// ─────────────────────────── кабинет склада ───────────────────────────

/** 🔶 Период, за который считается спрос для плана закупок. В спеке срок
 *  не назван; квартал — минимальный отрезок, на котором видно сезонность. */
export const DEMAND_PERIOD_DAYS = 90;

export const batchListSchema = z.object({
  plantId: z.coerce.number().int().positive().optional(),
});

export const receiveSchema = z.object({
  plantId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive().max(10_000),
  receivedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД")
    .optional(),
  supplier: z.string().trim().min(2).max(120),
});

export const writeOffSchema = z.object({
  batchId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
  reason: z.string().trim().min(3, "Причина списания обязательна").max(200),
});

export type BatchRow = {
  id: number;
  plantId: number;
  plantName: string;
  receivedAt: string;
  quantity: number;
  remaining: number;
  supplier: string;
  writtenOff: number;
};

export async function listBatches(raw: unknown): Promise<Result<BatchRow[]>> {
  const parsed = batchListSchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "Неверное растение", parsed.error.issues);

  const rows = await getDb()
    .select({
      id: batches.id,
      plantId: batches.plantId,
      plantName: plants.nameRu,
      receivedAt: batches.receivedAt,
      quantity: batches.quantity,
      remaining: batches.remaining,
      supplier: batches.supplier,
      writtenOff: sql<number>`coalesce((
        select sum(${writeOffs.quantity})::int from ${writeOffs}
        where ${writeOffs.batchId} = ${batches.id}
      ), 0)`,
    })
    .from(batches)
    .innerJoin(plants, eq(plants.id, batches.plantId))
    .where(parsed.data.plantId ? eq(batches.plantId, parsed.data.plantId) : sql`true`)
    // Тот же порядок, что у резерва: старое сверху, чтобы глаз сверял одинаково.
    .orderBy(asc(plants.nameRu), asc(batches.receivedAt), asc(batches.id));

  return ok(rows);
}

/** Приход партии. Новая партия всегда полная: remaining равен quantity. */
export async function receiveBatch(
  raw: unknown,
): Promise<Result<{ batchId: number; plantId: number; remaining: number }>> {
  const parsed = receiveSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("validation_failed", parsed.error.issues[0]?.message ?? "Проверьте приход", parsed.error.issues);
  }
  const { plantId, quantity, receivedAt, supplier } = parsed.data;

  const db = getDb();
  const [plant] = await db.select({ id: plants.id }).from(plants).where(eq(plants.id, plantId)).limit(1);
  if (!plant) return fail("not_found", "Такого растения нет");

  const [created] = await db
    .insert(batches)
    .values({
      plantId,
      receivedAt: receivedAt ?? new Date().toISOString().slice(0, 10),
      quantity,
      remaining: quantity,
      supplier,
    })
    .returning();

  return ok({ batchId: created.id, plantId, remaining: created.remaining });
}

/**
 * Списание из партии. Больше остатка списать нельзя — AC18.
 *
 * Проверка и уменьшение идут в одной транзакции с блокировкой строки:
 * без неё два одновременных списания прошли бы каждое по своей проверке
 * и вместе увели остаток в минус. Ниже нуля не пустит и ограничение схемы,
 * но отказ пользователю обязан быть внятным, а не падением запроса.
 */
export async function writeOff(
  raw: unknown,
  actorId: number,
): Promise<Result<{ batchId: number; remaining: number; writtenOff: number }>> {
  const parsed = writeOffSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("validation_failed", parsed.error.issues[0]?.message ?? "Проверьте списание", parsed.error.issues);
  }
  const { batchId, quantity, reason } = parsed.data;

  const db = getDb();
  const outcome = await db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ id: batches.id, remaining: batches.remaining })
      .from(batches)
      .where(eq(batches.id, batchId))
      .for("update");

    if (!locked) return { kind: "missing" as const };
    if (quantity > locked.remaining) {
      return { kind: "short" as const, remaining: locked.remaining };
    }

    await tx
      .update(batches)
      .set({ remaining: locked.remaining - quantity })
      .where(eq(batches.id, batchId));

    await tx.insert(writeOffs).values({ batchId, quantity, reason, actorId });

    return { kind: "done" as const, remaining: locked.remaining - quantity };
  });

  if (outcome.kind === "missing") return fail("not_found", "Такой партии нет");
  if (outcome.kind === "short") {
    return fail(
      "write_off_exceeds_stock",
      `В партии осталось ${outcome.remaining} — списать больше нельзя`,
    );
  }

  return ok({ batchId, remaining: outcome.remaining, writtenOff: quantity });
}

export type PurchasePlanRow = {
  plantId: number;
  plantName: string;
  plantingSeason: string;
  sold: number;
  rejected: number;
  inStock: number;
  recommended: number;
};

/**
 * План закупок по фиксированной формуле из спеки:
 *   продано за период + отказы из-за нехватки остатка − текущий остаток.
 *
 * Никакой прогнозной алгоритмики здесь нет и не предполагается — это прямо
 * записано во «вне скоупа». Формула печатается на экране рядом с таблицей,
 * чтобы закупщик видел, откуда взялось число, и мог не поверить ему.
 */
export async function purchasePlan(): Promise<
  Result<{ periodDays: number; since: string; rows: PurchasePlanRow[] }>
> {
  const since = new Date();
  since.setDate(since.getDate() - DEMAND_PERIOD_DAYS);
  const sinceIso = since.toISOString().slice(0, 10);

  const rows = await getDb()
    .select({
      plantId: plants.id,
      plantName: plants.nameRu,
      plantingSeason: plants.plantingSeason,
      sold: sql<number>`coalesce(sum(case when ${demandFacts.kind} = 'sold' then ${demandFacts.quantity} end), 0)::int`,
      rejected: sql<number>`coalesce(sum(case when ${demandFacts.kind} = 'rejected_no_stock' then ${demandFacts.quantity} end), 0)::int`,
      inStock: sql<number>`coalesce((
        select sum(${batches.remaining})::int from ${batches} where ${batches.plantId} = ${plants.id}
      ), 0)`,
    })
    .from(plants)
    .leftJoin(
      demandFacts,
      and(eq(demandFacts.plantId, plants.id), gte(demandFacts.occurredAt, since)),
    )
    .where(eq(plants.isActive, true))
    .groupBy(plants.id, plants.nameRu, plants.plantingSeason)
    .orderBy(asc(plants.nameRu));

  return ok({
    periodDays: DEMAND_PERIOD_DAYS,
    since: sinceIso,
    rows: rows.map((row) => ({
      ...row,
      // Отрицательная потребность — это излишек, закупать нечего.
      recommended: Math.max(0, row.sold + row.rejected - row.inStock),
    })),
  });
}
