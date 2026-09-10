import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { notifications } from "@/db/shared-schema";
import { fail, ok, type Result } from "@/lib/result";
import { plants } from "@/modules/catalog";
import { fillGardenFromOrder, todayIso } from "@/modules/garden";
import { recordRejectedDemand, recordSoldDemand, release, reserve } from "@/modules/warehouse";
import {
  cartItems,
  deliverySlots,
  orderItems,
  orders,
  orderStatusHistory,
} from "./schema";
import { allowedNext, canTransition, STATUS_LABEL, type Fulfillment, type OrderStatus } from "./transitions";

/** 🔶 Три фиксированных слота в день — заглушка доставки без геокодинга, spec §8. */
const SLOT_INTERVALS = ["10:00–13:00", "13:00–16:00", "16:00–19:00"];
/** На сколько дней вперёд расписание дописывается при чтении. Фоновых процессов нет. */
const SLOT_HORIZON_DAYS = 7;

const dayIso = (shift: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + shift);
  return d.toISOString().slice(0, 10);
};

// ─────────────────────────────── корзина ───────────────────────────────

export const cartItemSchema = z.object({
  plantId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1).max(99),
});

export const plantRefSchema = z.object({ plantId: z.coerce.number().int().positive() });

export type CartLine = {
  plantId: number;
  nameRu: string;
  nameLat: string;
  quantity: number;
  priceCents: number;
  sumCents: number;
};

export type Cart = { lines: CartLine[]; totalCents: number };

export async function getCart(customerId: number): Promise<Result<Cart>> {
  const lines = await getDb()
    .select({
      plantId: cartItems.plantId,
      nameRu: plants.nameRu,
      nameLat: plants.nameLat,
      quantity: cartItems.quantity,
      priceCents: plants.priceCents,
    })
    .from(cartItems)
    .innerJoin(plants, eq(plants.id, cartItems.plantId))
    .where(eq(cartItems.customerId, customerId))
    .orderBy(asc(plants.nameRu));

  const withSums = lines.map((l) => ({ ...l, sumCents: l.quantity * l.priceCents }));
  return ok({
    lines: withSums,
    totalCents: withSums.reduce((sum, l) => sum + l.sumCents, 0),
  });
}

/** Добавление прибавляет к тому, что уже лежит: повторное «в корзину» не затирает. */
export async function addToCart(raw: unknown, customerId: number): Promise<Result<Cart>> {
  const parsed = cartItemSchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "Неверная позиция", parsed.error.issues);
  const { plantId, quantity } = parsed.data;

  const [plant] = await getDb().select().from(plants).where(eq(plants.id, plantId)).limit(1);
  if (!plant) return fail("not_found", "Такого растения нет в каталоге");
  if (!plant.isActive) return fail("bad_request", "Растение снято с продажи");

  await getDb()
    .insert(cartItems)
    .values({ customerId, plantId, quantity })
    .onConflictDoUpdate({
      target: [cartItems.customerId, cartItems.plantId],
      set: { quantity: sql`least(${cartItems.quantity} + ${quantity}, 99)` },
    });

  return getCart(customerId);
}

export async function setQty(raw: unknown, customerId: number): Promise<Result<Cart>> {
  const parsed = cartItemSchema.safeParse(raw);
  if (!parsed.success) {
    // Ноль и отрицательное сюда не проходят: убрать позицию — отдельное действие.
    return fail("validation_failed", "Количество — от 1 до 99", parsed.error.issues);
  }
  const { plantId, quantity } = parsed.data;

  const updated = await getDb()
    .update(cartItems)
    .set({ quantity })
    .where(and(eq(cartItems.customerId, customerId), eq(cartItems.plantId, plantId)))
    .returning({ id: cartItems.id });

  if (updated.length === 0) return fail("not_found", "Этой позиции нет в корзине");
  return getCart(customerId);
}

export async function removeFromCart(raw: unknown, customerId: number): Promise<Result<Cart>> {
  const parsed = plantRefSchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "Неверная позиция", parsed.error.issues);

  await getDb()
    .delete(cartItems)
    .where(and(eq(cartItems.customerId, customerId), eq(cartItems.plantId, parsed.data.plantId)));

  return getCart(customerId);
}

// ─────────────────────────────── слоты ───────────────────────────────

export type DeliverySlot = {
  id: number;
  slotDate: string;
  interval: string;
  capacity: number;
  taken: number;
  isFull: boolean;
};

/** Дописывает недостающие слоты на горизонт вперёд и отдаёт будущие.
 *  Расписание материализуется при чтении — планировщика в продукте нет. */
export async function listSlots(): Promise<Result<DeliverySlot[]>> {
  const db = getDb();
  const rows = Array.from({ length: SLOT_HORIZON_DAYS }, (_, i) => dayIso(i + 1)).flatMap((date) =>
    SLOT_INTERVALS.map((interval) => ({ slotDate: date, interval })),
  );

  await db.insert(deliverySlots).values(rows).onConflictDoNothing();

  const slots = await db
    .select()
    .from(deliverySlots)
    // Прошедшие даты недоступны для выбора — spec §3.2, AC7.
    .where(gte(deliverySlots.slotDate, dayIso(1)))
    .orderBy(asc(deliverySlots.slotDate), asc(deliverySlots.interval));

  return ok(
    slots.map((s) => ({
      id: s.id,
      slotDate: s.slotDate,
      interval: s.interval,
      capacity: s.capacity,
      taken: s.taken,
      isFull: s.taken >= s.capacity,
    })),
  );
}

// ─────────────────────────────── заказ ───────────────────────────────

export const createOrderSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("pickup"),
    /** Один ключ на попытку оформления: двойное нажатие не создаёт второй заказ. */
    idempotencyKey: z.string().min(8).max(100),
  }),
  z.object({
    method: z.literal("delivery"),
    slotId: z.coerce.number().int().positive(),
    idempotencyKey: z.string().min(8).max(100),
  }),
]);

export type CreatedOrder = { orderId: number; status: OrderStatus; totalCents: number };

export async function createOrder(raw: unknown, customerId: number): Promise<Result<CreatedOrder>> {
  const parsed = createOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("validation_failed", "Проверьте способ получения", parsed.error.issues);
  }
  const input = parsed.data;
  const db = getDb();

  // Повторное подтверждение отдаёт тот же заказ, а не создаёт второй.
  const [existing] = await db
    .select()
    .from(orders)
    .where(eq(orders.idempotencyKey, input.idempotencyKey))
    .limit(1);
  if (existing) {
    return ok({ orderId: existing.id, status: existing.status, totalCents: existing.totalCents });
  }

  const cart = await getCart(customerId);
  if (!cart.ok) return cart;
  if (cart.data.lines.length === 0) return fail("bad_request", "Корзина пуста");

  const items = cart.data.lines.map((l) => ({ plantId: l.plantId, quantity: l.quantity }));

  // Нехватка живёт вне транзакции: внутри неё факт спроса откатится вместе с заказом.
  let shortage: Awaited<ReturnType<typeof reserve>> = [];
  let slotTaken = false;

  const created = await db
    .transaction(async (tx) => {
      if (input.method === "delivery") {
        // Слот занимается тем же условием, что стоит в check: гонку ловит база.
        const claimed = await tx
          .update(deliverySlots)
          .set({ taken: sql`${deliverySlots.taken} + 1` })
          .where(
            and(
              eq(deliverySlots.id, input.slotId),
              sql`${deliverySlots.taken} < ${deliverySlots.capacity}`,
            ),
          )
          .returning({ id: deliverySlots.id });

        if (claimed.length === 0) {
          slotTaken = true;
          throw new Error("slot_full");
        }
      }

      const [order] = await tx
        .insert(orders)
        .values({
          customerId,
          status: "new",
          fulfillment: input.method,
          slotId: input.method === "delivery" ? input.slotId : null,
          totalCents: cart.data.totalCents,
          idempotencyKey: input.idempotencyKey,
        })
        .returning();

      await tx.insert(orderItems).values(
        cart.data.lines.map((l) => ({
          orderId: order.id,
          plantId: l.plantId,
          quantity: l.quantity,
          priceCents: l.priceCents,
        })),
      );

      shortage = await reserve(tx, order.id, items);
      // throw внутри колбэка — единственный способ отката, так и задумано.
      if (shortage.length > 0) throw new Error("no_stock");

      await recordSoldDemand(tx, items);

      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: null,
        toStatus: "new",
        actorRole: "customer",
      });

      // Корзина освобождается только вместе с успешным заказом.
      await tx.delete(cartItems).where(eq(cartItems.customerId, customerId));

      return order;
    })
    .catch(() => null);

  if (created === null) {
    if (slotTaken) return fail("slot_full", "Этот слот уже заняли. Выберите другой.");
    // Отдельной транзакцией, уже после отката — иначе план закупок не увидит отказ.
    await recordRejectedDemand(shortage);
    return fail("no_stock", "Остатка не хватает", { short: shortage });
  }

  return ok({ orderId: created.id, status: created.status, totalCents: created.totalCents });
}

export const orderRefSchema = z.object({ orderId: z.coerce.number().int().positive() });

export type OrderView = {
  id: number;
  status: OrderStatus;
  statusLabel: string;
  fulfillment: Fulfillment;
  slot: { slotDate: string; interval: string } | null;
  totalCents: number;
  isPaid: boolean;
  createdAt: string;
  items: { plantId: number; nameRu: string; quantity: number; priceCents: number }[];
  history: { toStatus: OrderStatus; label: string; actorRole: string; at: string }[];
  nextStatuses: OrderStatus[];
};

export async function getOrder(raw: unknown, customerId: number): Promise<Result<OrderView>> {
  const parsed = orderRefSchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "Неверный номер заказа", parsed.error.issues);

  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, parsed.data.orderId)).limit(1);
  if (!order) return fail("not_found", "Такого заказа нет");
  // Чужой заказ не показываем: разграничение живёт и в сервисе, не только в UI.
  if (order.customerId !== customerId) return fail("forbidden", "Это заказ другого покупателя");

  const items = await db
    .select({
      plantId: orderItems.plantId,
      nameRu: plants.nameRu,
      quantity: orderItems.quantity,
      priceCents: orderItems.priceCents,
    })
    .from(orderItems)
    .innerJoin(plants, eq(plants.id, orderItems.plantId))
    .where(eq(orderItems.orderId, order.id))
    .orderBy(asc(plants.nameRu));

  const history = await db
    .select({
      toStatus: orderStatusHistory.toStatus,
      actorRole: orderStatusHistory.actorRole,
      at: orderStatusHistory.at,
    })
    .from(orderStatusHistory)
    .where(eq(orderStatusHistory.orderId, order.id))
    .orderBy(asc(orderStatusHistory.at), asc(orderStatusHistory.id));

  let slot: OrderView["slot"] = null;
  if (order.slotId !== null) {
    const [row] = await db
      .select({ slotDate: deliverySlots.slotDate, interval: deliverySlots.interval })
      .from(deliverySlots)
      .where(eq(deliverySlots.id, order.slotId))
      .limit(1);
    slot = row ?? null;
  }

  return ok({
    id: order.id,
    status: order.status,
    statusLabel: STATUS_LABEL[order.status],
    fulfillment: order.fulfillment,
    slot,
    totalCents: order.totalCents,
    isPaid: order.isPaid,
    createdAt: order.createdAt.toISOString(),
    items,
    history: history.map((h) => ({
      toStatus: h.toStatus,
      label: STATUS_LABEL[h.toStatus],
      actorRole: h.actorRole,
      at: h.at.toISOString(),
    })),
    // Что покупатель или склад может сделать дальше — считает граф, а не экран.
    nextStatuses: allowedNext(order.status, order.fulfillment),
  });
}

export type OrderSummary = {
  id: number;
  status: OrderStatus;
  statusLabel: string;
  fulfillment: Fulfillment;
  totalCents: number;
  createdAt: string;
  itemCount: number;
};

export async function listOrders(customerId: number): Promise<Result<OrderSummary[]>> {
  // Агрегат берётся join + group by, а не коррелированным подзапросом в sql``:
  // там drizzle подставляет колонку без имени таблицы, и подзапрос молча
  // ловит чужую — memory/mistakes/2026-09-10-nekvalificirovannaya-kolonka-v-sql.md
  const rows = await getDb()
    .select({
      id: orders.id,
      status: orders.status,
      fulfillment: orders.fulfillment,
      totalCents: orders.totalCents,
      createdAt: orders.createdAt,
      itemCount: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
    })
    .from(orders)
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(eq(orders.customerId, customerId))
    .groupBy(orders.id)
    .orderBy(desc(orders.createdAt), desc(orders.id));

  return ok(
    rows.map((r) => ({
      ...r,
      statusLabel: STATUS_LABEL[r.status],
      createdAt: r.createdAt.toISOString(),
    })),
  );
}

export const transitionSchema = z.object({
  orderId: z.coerce.number().int().positive(),
  next: z.enum(["assembling", "ready_for_pickup", "handed_to_delivery", "done", "cancelled"]),
});

/** Единственный путь смены статуса. Прямой update в обход поставит недопустимое
 *  значение: граф в схеме не выражен — ADR-0002. */
export async function transition(
  raw: unknown,
  actor: { userId: number; role: string },
): Promise<Result<{ orderId: number; status: OrderStatus; statusLabel: string }>> {
  const parsed = transitionSchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "Неверный переход", parsed.error.issues);
  const { orderId, next } = parsed.data;

  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return fail("not_found", "Такого заказа нет");

  // Покупатель распоряжается только своим заказом и только отменой.
  if (actor.role === "customer") {
    if (order.customerId !== actor.userId) return fail("forbidden", "Это заказ другого покупателя");
    if (next !== "cancelled") return fail("forbidden", "Статус заказа меняет питомник");
  }

  if (!canTransition(order.status, next, order.fulfillment)) {
    return fail(
      "invalid_transition",
      `Из статуса «${STATUS_LABEL[order.status]}» нельзя перейти в «${STATUS_LABEL[next]}»`,
    );
  }

  await db.transaction(async (tx) => {
    await tx.update(orders).set({ status: next }).where(eq(orders.id, orderId));

    await tx.insert(orderStatusHistory).values({
      orderId,
      fromStatus: order.status,
      toStatus: next,
      actorRole: actor.role,
    });

    if (next === "done") {
      // Сад наполняется ровно тогда, когда заказ стал выполненным, — в той же
      // транзакции. Повторный перевод не задваивает: upsert по составу и
      // unique по событию. Модуль зовётся через свой index.ts, не напрямую.
      const bought = await tx
        .select({ plantId: orderItems.plantId, quantity: orderItems.quantity })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      await fillGardenFromOrder(tx, order.customerId, bought, todayIso());
    }

    if (next === "cancelled") {
      // Резерв возвращается ровно в те партии, из которых был взят.
      await release(tx, orderId);
      if (order.slotId !== null) {
        await tx
          .update(deliverySlots)
          .set({ taken: sql`greatest(${deliverySlots.taken} - 1, 0)` })
          .where(eq(deliverySlots.id, order.slotId));
      }
    }

    // Уведомление — заглушка: запись в таблицу, наружу ничего не уходит.
    await tx.insert(notifications).values({
      userId: order.customerId,
      kind: "order_status",
      payload: { orderId, status: next, label: STATUS_LABEL[next] },
    });
  });

  return ok({ orderId, status: next, statusLabel: STATUS_LABEL[next] });
}

export * from "./transitions";
