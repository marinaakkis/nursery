import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "@/db/shared-schema";
import { plants } from "@/modules/catalog";
import { batches } from "@/modules/warehouse";

export const orderStatus = pgEnum("order_status", [
  "new",
  "assembling",
  "ready_for_pickup",
  "handed_to_delivery",
  "done",
  "cancelled",
]);
export const fulfillment = pgEnum("fulfillment", ["pickup", "delivery"]);

/** Корзина — черновик заказа. Остаток не резервирует. */
export const cartItems = pgTable(
  "cart_items",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => users.id),
    plantId: integer("plant_id")
      .notNull()
      .references(() => plants.id),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    unique("cart_items_customer_plant_uq").on(t.customerId, t.plantId),
    check("cart_items_quantity_ck", sql`${t.quantity} > 0`),
  ],
);

/** Слоты дописываются на 7 дней вперёд при чтении, on conflict do nothing. Фонового процесса нет. */
export const deliverySlots = pgTable(
  "delivery_slots",
  {
    id: serial("id").primaryKey(),
    slotDate: date("slot_date").notNull(),
    interval: text("interval").notNull(),
    capacity: integer("capacity").notNull().default(5),
    taken: integer("taken").notNull().default(0),
  },
  (t) => [
    unique("delivery_slots_date_interval_uq").on(t.slotDate, t.interval),
    check("delivery_slots_capacity_ck", sql`${t.taken} <= ${t.capacity}`),
    check("delivery_slots_taken_nonneg_ck", sql`${t.taken} >= 0`),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => users.id),
    status: orderStatus("status").notNull().default("new"),
    fulfillment: fulfillment("fulfillment").notNull(),
    slotId: integer("slot_id").references(() => deliverySlots.id),
    totalCents: integer("total_cents").notNull(),
    isPaid: boolean("is_paid").notNull().default(false),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    unique("orders_idempotency_uq").on(t.idempotencyKey),
    check(
      "orders_delivery_slot_ck",
      sql`(${t.fulfillment} = 'delivery') = (${t.slotId} is not null)`,
    ),
    check("orders_total_ck", sql`${t.totalCents} > 0`),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id),
    plantId: integer("plant_id")
      .notNull()
      .references(() => plants.id),
    quantity: integer("quantity").notNull(),
    priceCents: integer("price_cents").notNull(),
  },
  (t) => [check("order_items_quantity_ck", sql`${t.quantity} > 0`)],
);

/** Из какой партии сколько взято — без этого отмену некуда возвращать. */
export const orderReservations = pgTable(
  "order_reservations",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id),
    batchId: integer("batch_id")
      .notNull()
      .references(() => batches.id),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    unique("order_reservations_order_batch_uq").on(t.orderId, t.batchId),
    check("order_reservations_quantity_ck", sql`${t.quantity} > 0`),
  ],
);

export const orderStatusHistory = pgTable("order_status_history", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id),
  fromStatus: orderStatus("from_status"),
  toStatus: orderStatus("to_status").notNull(),
  actorRole: text("actor_role").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().default(sql`now()`),
});
