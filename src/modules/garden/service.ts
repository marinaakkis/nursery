import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { fail, ok, type Result } from "@/lib/result";
import { careRules, plants } from "@/modules/catalog";
import { careEvents, gardenPlants } from "./schema";

/**
 * Сад покупателя и календарь ухода.
 *
 * Два свойства, из которых растёт весь модуль (ADR 0002):
 * события материализуются в момент действия, фоновых процессов нет;
 * «просрочено» не хранится, а вычисляется при чтении.
 */

/** 🔶 «Сезон вперёд» — полгода. В спеке срок не назван; полгода закрывают
 *  и лето, и осень, а при отметке выполнения календарь всё равно продлевается. */
export const CARE_HORIZON_DAYS = 180;

/** 🔶 Сезон ухода — апрель–октябрь. Спека требует не считать просроченным
 *  сезонное событие вне сезона (§3.3), но границ не задаёт. */
export const SEASON_FROM_MONTH = 4;
export const SEASON_TO_MONTH = 10;

export const CARE_TYPE_LABEL: Record<string, string> = {
  watering: "полив",
  feeding: "подкормка",
  pruning: "обрезка",
};

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

const isoOf = (date: Date): string => date.toISOString().slice(0, 10);

export const todayIso = (): string => isoOf(new Date());

const shiftIso = (iso: string, days: number): string => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoOf(date);
};

const monthOf = (iso: string): number => Number(iso.slice(5, 7));

const inSeason = (iso: string): boolean =>
  monthOf(iso) >= SEASON_FROM_MONTH && monthOf(iso) <= SEASON_TO_MONTH;

/**
 * Просрочено ли событие. Считается при чтении, а не хранится: иначе понадобился бы
 * процесс, который каждый день пересчитывает поле у всех событий.
 * Сезонное событие вне сезона просроченным не считается — spec §3.3.
 */
export function isOverdue(event: { plannedOn: string; isDone: boolean; seasonOnly: boolean }, today: string): boolean {
  if (event.isDone) return false;
  if (event.plannedOn >= today) return false;
  if (event.seasonOnly && !inSeason(event.plannedOn)) return false;
  return true;
}

/**
 * Расписание одного правила на горизонт вперёд от указанной даты.
 * Первое событие — через период, а не в день покупки: только что посаженное
 * растение не поливают повторно в тот же день.
 */
export function planDates(from: string, periodDays: number, horizonDays = CARE_HORIZON_DAYS): string[] {
  const dates: string[] = [];
  for (let day = periodDays; day <= horizonDays; day += periodDays) {
    dates.push(shiftIso(from, day));
  }
  return dates;
}

/**
 * Кладёт растения заказа в сад и сразу материализует календарь ухода.
 * Вызывается из orders.transition внутри той же транзакции: сад наполняется
 * ровно тогда, когда заказ стал выполненным, или не наполняется вовсе.
 *
 * Повторная покупка того же растения увеличивает количество и не создаёт
 * второй строки; события не задваиваются за счёт unique в схеме.
 *
 * 🔶 Ссылки на заказ в саду нет — так решено в ADR 0002: календарю она ничего
 * не даёт, а при двух покупках одного растения была бы неоднозначной. Заказ
 * прослеживается через order_items.
 */
export async function fillGardenFromOrder(
  tx: Tx,
  customerId: number,
  items: { plantId: number; quantity: number }[],
  onDate: string,
): Promise<void> {
  if (items.length === 0) return;

  const plantIds = items.map((item) => item.plantId);

  const rows = await tx
    .insert(gardenPlants)
    .values(
      items.map((item) => ({
        customerId,
        plantId: item.plantId,
        quantity: item.quantity,
        acquiredAt: onDate,
      })),
    )
    // Дата первой покупки не переписывается: она отвечает на вопрос «когда завёл».
    .onConflictDoUpdate({
      target: [gardenPlants.customerId, gardenPlants.plantId],
      set: { quantity: sql`${gardenPlants.quantity} + excluded.quantity` },
    })
    .returning({ id: gardenPlants.id, plantId: gardenPlants.plantId });

  const rules = await tx
    .select({ plantId: careRules.plantId, type: careRules.type, periodDays: careRules.periodDays })
    .from(careRules)
    .where(inArray(careRules.plantId, plantIds));

  const events = rows.flatMap((row) =>
    rules
      .filter((rule) => rule.plantId === row.plantId)
      .flatMap((rule) =>
        planDates(onDate, rule.periodDays).map((plannedOn) => ({
          gardenPlantId: row.id,
          type: rule.type,
          plannedOn,
        })),
      ),
  );

  if (events.length === 0) return;

  // Повторный перевод заказа в «выполнен» не задваивает календарь.
  await tx.insert(careEvents).values(events).onConflictDoNothing();
}

// ─────────────────────────────── чтение ───────────────────────────────

export type GardenPlantView = {
  gardenPlantId: number;
  plantId: number;
  nameRu: string;
  nameLat: string;
  quantity: number;
  acquiredAt: string;
  /** Ближайшее невыполненное действие: что и через сколько дней. */
  next: { type: string; label: string; plannedOn: string; inDays: number; overdue: boolean } | null;
  overdueCount: number;
};

export async function listGarden(customerId: number): Promise<Result<GardenPlantView[]>> {
  const today = todayIso();
  const db = getDb();

  const mine = await db
    .select({
      gardenPlantId: gardenPlants.id,
      plantId: gardenPlants.plantId,
      quantity: gardenPlants.quantity,
      acquiredAt: gardenPlants.acquiredAt,
      nameRu: plants.nameRu,
      nameLat: plants.nameLat,
    })
    .from(gardenPlants)
    .innerJoin(plants, eq(plants.id, gardenPlants.plantId))
    .where(eq(gardenPlants.customerId, customerId))
    .orderBy(asc(plants.nameRu));

  if (mine.length === 0) return ok([]);

  const ids = mine.map((row) => row.gardenPlantId);
  const events = await db
    .select({
      gardenPlantId: careEvents.gardenPlantId,
      type: careEvents.type,
      plannedOn: careEvents.plannedOn,
      isDone: careEvents.isDone,
      seasonOnly: careRules.seasonOnly,
    })
    .from(careEvents)
    .innerJoin(gardenPlants, eq(gardenPlants.id, careEvents.gardenPlantId))
    .leftJoin(
      careRules,
      and(eq(careRules.plantId, gardenPlants.plantId), eq(careRules.type, careEvents.type)),
    )
    .where(and(inArray(careEvents.gardenPlantId, ids), eq(careEvents.isDone, false)))
    .orderBy(asc(careEvents.plannedOn));

  return ok(
    mine.map((row) => {
      const own = events.filter((event) => event.gardenPlantId === row.gardenPlantId);
      const overdue = own.filter((event) =>
        isOverdue({ ...event, seasonOnly: event.seasonOnly ?? false }, today),
      );
      const nearest = own[0];

      return {
        ...row,
        overdueCount: overdue.length,
        next: nearest
          ? {
              type: nearest.type,
              label: CARE_TYPE_LABEL[nearest.type] ?? nearest.type,
              plannedOn: nearest.plannedOn,
              inDays: Math.round(
                (Date.parse(`${nearest.plannedOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
                  86_400_000,
              ),
              overdue: isOverdue(
                { ...nearest, seasonOnly: nearest.seasonOnly ?? false },
                today,
              ),
            }
          : null,
      };
    }),
  );
}

export const calendarRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type CareEventView = {
  id: number;
  gardenPlantId: number;
  plantId: number;
  nameRu: string;
  type: string;
  label: string;
  plannedOn: string;
  isDone: boolean;
  doneOn: string | null;
  overdue: boolean;
  seasonOnly: boolean;
};

/**
 * События покупателя за период. Просроченные приходят целиком, независимо от
 * начала периода: иначе они потерялись бы при переходе на следующую неделю.
 */
export async function listCareEvents(
  raw: unknown,
  customerId: number,
): Promise<Result<{ events: CareEventView[]; dueCount: number }>> {
  const parsed = calendarRangeSchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "Неверный период", parsed.error.issues);

  const today = todayIso();
  const from = parsed.data.from ?? today;
  const to = parsed.data.to ?? shiftIso(from, 6);

  const rows = await getDb()
    .select({
      id: careEvents.id,
      gardenPlantId: careEvents.gardenPlantId,
      plantId: gardenPlants.plantId,
      nameRu: plants.nameRu,
      type: careEvents.type,
      plannedOn: careEvents.plannedOn,
      isDone: careEvents.isDone,
      doneOn: careEvents.doneOn,
      seasonOnly: careRules.seasonOnly,
    })
    .from(careEvents)
    .innerJoin(gardenPlants, eq(gardenPlants.id, careEvents.gardenPlantId))
    .innerJoin(plants, eq(plants.id, gardenPlants.plantId))
    .leftJoin(
      careRules,
      and(eq(careRules.plantId, gardenPlants.plantId), eq(careRules.type, careEvents.type)),
    )
    .where(
      and(
        eq(gardenPlants.customerId, customerId),
        // В окно попадает либо период, либо любая невыполненная просрочка.
        sql`(${careEvents.plannedOn} between ${from} and ${to}
             or (${careEvents.isDone} = false and ${careEvents.plannedOn} < ${today}))`,
      ),
    )
    .orderBy(asc(careEvents.plannedOn), asc(plants.nameRu));

  const events: CareEventView[] = rows.map((row) => {
    const seasonOnly = row.seasonOnly ?? false;
    return {
      ...row,
      seasonOnly,
      label: CARE_TYPE_LABEL[row.type] ?? row.type,
      overdue: isOverdue({ plannedOn: row.plannedOn, isDone: row.isDone, seasonOnly }, today),
    };
  });

  // Напоминание в шапке: всё, что уже пора сделать и ещё не сделано.
  const dueCount = events.filter(
    (event) => !event.isDone && event.plannedOn <= today && !(event.seasonOnly && !inSeason(event.plannedOn)),
  ).length;

  return ok({ events, dueCount });
}

export async function countDueCareEvents(customerId: number): Promise<number> {
  const today = todayIso();
  const [row] = await getDb()
    .select({ total: sql<number>`count(*)::int` })
    .from(careEvents)
    .innerJoin(gardenPlants, eq(gardenPlants.id, careEvents.gardenPlantId))
    .where(
      and(
        eq(gardenPlants.customerId, customerId),
        eq(careEvents.isDone, false),
        lte(careEvents.plannedOn, today),
      ),
    );
  return row?.total ?? 0;
}

// ─────────────────────────────── отметки ───────────────────────────────

export const careEventSchema = z.object({ eventId: z.coerce.number().int().positive() });

/**
 * Отметка выполнения. Идемпотентна: повторное нажатие ничего не меняет
 * и второго следующего события не создаёт — spec §3.3.
 *
 * Следующее событие того же типа считается от фактической даты, а не от плановой:
 * если полили на три дня позже, следующий полив тоже сдвигается.
 */
export async function markCareDone(
  raw: unknown,
  customerId: number,
): Promise<Result<{ eventId: number; nextPlannedOn: string | null; alreadyDone: boolean }>> {
  const parsed = careEventSchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "Неверное событие", parsed.error.issues);
  const { eventId } = parsed.data;

  const db = getDb();
  const [event] = await db
    .select({
      id: careEvents.id,
      gardenPlantId: careEvents.gardenPlantId,
      plantId: gardenPlants.plantId,
      customerId: gardenPlants.customerId,
      type: careEvents.type,
      isDone: careEvents.isDone,
    })
    .from(careEvents)
    .innerJoin(gardenPlants, eq(gardenPlants.id, careEvents.gardenPlantId))
    .where(eq(careEvents.id, eventId))
    .limit(1);

  if (!event) return fail("not_found", "Такого события нет");
  if (event.customerId !== customerId) return fail("forbidden", "Это событие другого покупателя");
  if (event.isDone) return ok({ eventId, nextPlannedOn: null, alreadyDone: true });

  const today = todayIso();

  const [rule] = await db
    .select({ periodDays: careRules.periodDays })
    .from(careRules)
    .where(and(eq(careRules.plantId, event.plantId), eq(careRules.type, event.type)))
    .limit(1);

  const nextPlannedOn = rule ? shiftIso(today, rule.periodDays) : null;

  await db.transaction(async (tx) => {
    await tx
      .update(careEvents)
      .set({ isDone: true, doneOn: today })
      .where(and(eq(careEvents.id, eventId), eq(careEvents.isDone, false)));

    if (nextPlannedOn) {
      await tx
        .insert(careEvents)
        .values({ gardenPlantId: event.gardenPlantId, type: event.type, plannedOn: nextPlannedOn })
        .onConflictDoNothing();
    }
  });

  return ok({ eventId, nextPlannedOn, alreadyDone: false });
}

/** Снятие отметки: событие возвращается в план. Порождённое им следующее
 *  событие не удаляется — оно уже могло быть выполнено, а лишний полив
 *  в календаре дешевле пропущенного. */
export async function unmarkCareDone(
  raw: unknown,
  customerId: number,
): Promise<Result<{ eventId: number }>> {
  const parsed = careEventSchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "Неверное событие", parsed.error.issues);
  const { eventId } = parsed.data;

  const db = getDb();
  const [event] = await db
    .select({ id: careEvents.id, customerId: gardenPlants.customerId })
    .from(careEvents)
    .innerJoin(gardenPlants, eq(gardenPlants.id, careEvents.gardenPlantId))
    .where(eq(careEvents.id, eventId))
    .limit(1);

  if (!event) return fail("not_found", "Такого события нет");
  if (event.customerId !== customerId) return fail("forbidden", "Это событие другого покупателя");

  await db.update(careEvents).set({ isDone: false, doneOn: null }).where(eq(careEvents.id, eventId));
  return ok({ eventId });
}

// ─────────────────────────── одно растение сада ───────────────────────────

export const gardenPlantSchema = z.object({ id: z.coerce.number().int().positive() });

export type GardenPlantDetail = {
  gardenPlantId: number;
  plantId: number;
  nameRu: string;
  nameLat: string;
  quantity: number;
  acquiredAt: string;
  rules: { type: string; label: string; periodDays: number; seasonOnly: boolean }[];
  upcoming: CareEventView[];
  history: CareEventView[];
};

export async function getGardenPlant(
  raw: unknown,
  customerId: number,
): Promise<Result<GardenPlantDetail>> {
  const parsed = gardenPlantSchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "Неверное растение", parsed.error.issues);

  const db = getDb();
  const [row] = await db
    .select({
      gardenPlantId: gardenPlants.id,
      plantId: gardenPlants.plantId,
      customerId: gardenPlants.customerId,
      quantity: gardenPlants.quantity,
      acquiredAt: gardenPlants.acquiredAt,
      nameRu: plants.nameRu,
      nameLat: plants.nameLat,
    })
    .from(gardenPlants)
    .innerJoin(plants, eq(plants.id, gardenPlants.plantId))
    .where(eq(gardenPlants.id, parsed.data.id))
    .limit(1);

  if (!row) return fail("not_found", "Такого растения в саду нет");
  if (row.customerId !== customerId) return fail("forbidden", "Это сад другого покупателя");

  const rules = await db
    .select({
      type: careRules.type,
      periodDays: careRules.periodDays,
      seasonOnly: careRules.seasonOnly,
    })
    .from(careRules)
    .where(eq(careRules.plantId, row.plantId));

  const events = await db
    .select({
      id: careEvents.id,
      type: careEvents.type,
      plannedOn: careEvents.plannedOn,
      isDone: careEvents.isDone,
      doneOn: careEvents.doneOn,
    })
    .from(careEvents)
    .where(eq(careEvents.gardenPlantId, row.gardenPlantId))
    .orderBy(asc(careEvents.plannedOn));

  const today = todayIso();
  const seasonOf = new Map(rules.map((rule) => [rule.type, rule.seasonOnly]));

  const view = (event: (typeof events)[number]): CareEventView => {
    const seasonOnly = seasonOf.get(event.type) ?? false;
    return {
      ...event,
      gardenPlantId: row.gardenPlantId,
      plantId: row.plantId,
      nameRu: row.nameRu,
      seasonOnly,
      label: CARE_TYPE_LABEL[event.type] ?? event.type,
      overdue: isOverdue({ plannedOn: event.plannedOn, isDone: event.isDone, seasonOnly }, today),
    };
  };

  return ok({
    gardenPlantId: row.gardenPlantId,
    plantId: row.plantId,
    nameRu: row.nameRu,
    nameLat: row.nameLat,
    quantity: row.quantity,
    acquiredAt: row.acquiredAt,
    rules: rules.map((rule) => ({ ...rule, label: CARE_TYPE_LABEL[rule.type] ?? rule.type })),
    upcoming: events.filter((event) => !event.isDone).map(view),
    history: events
      .filter((event) => event.isDone)
      .sort((a, b) => (a.doneOn ?? "").localeCompare(b.doneOn ?? ""))
      .reverse()
      .map(view),
  });
}
