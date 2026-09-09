import { sql } from "drizzle-orm";
import { check, date, index, integer, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "@/db/shared-schema";
import { plants } from "@/modules/catalog";

/** Партия — физическое поступление. Остаток растения = сумма остатков его партий. */
export const batches = pgTable(
  "batches",
  {
    id: serial("id").primaryKey(),
    plantId: integer("plant_id")
      .notNull()
      .references(() => plants.id),
    receivedAt: date("received_at").notNull(),
    quantity: integer("quantity").notNull(),
    remaining: integer("remaining").notNull(),
    supplier: text("supplier").notNull(),
  },
  (t) => [
    check("batches_remaining_nonneg_ck", sql`${t.remaining} >= 0`),
    check("batches_remaining_max_ck", sql`${t.remaining} <= ${t.quantity}`),
    // Индекс под выборку старейшей партии: тот же порядок, что в service.ts
    index("batches_oldest_idx").on(t.plantId, t.receivedAt, t.id),
  ],
);

export const writeOffs = pgTable(
  "write_offs",
  {
    id: serial("id").primaryKey(),
    batchId: integer("batch_id")
      .notNull()
      .references(() => batches.id),
    quantity: integer("quantity").notNull(),
    reason: text("reason").notNull(),
    actorId: integer("actor_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [check("write_offs_quantity_ck", sql`${t.quantity} > 0`)],
);

export const demandKind = pgEnum("demand_kind", ["sold", "rejected_no_stock"]);

/** Факты спроса: sold пишется в транзакции заказа, rejected_no_stock — после отката. */
export const demandFacts = pgTable(
  "demand_facts",
  {
    id: serial("id").primaryKey(),
    plantId: integer("plant_id")
      .notNull()
      .references(() => plants.id),
    quantity: integer("quantity").notNull(),
    kind: demandKind("kind").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [check("demand_facts_quantity_ck", sql`${t.quantity} > 0`)],
);
