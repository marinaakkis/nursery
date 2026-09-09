import { sql } from "drizzle-orm";
import { integer, jsonb, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/** Роли продукта. Настоящей аутентификации нет — роль следует из выбранного демо-пользователя. */
export const userRole = pgEnum("user_role", ["customer", "agronomist", "warehouse"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: userRole("role").notNull(),
});

/** Уведомления — только переходы статуса заказа. Напоминания об уходе сюда не пишутся. */
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  kind: text("kind").notNull(),
  payload: jsonb("payload").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});
