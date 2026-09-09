import { sql } from "drizzle-orm";
import { integer, pgEnum, pgTable, serial, smallint, text, timestamp } from "drizzle-orm/pg-core";
import { userRole, users } from "@/db/shared-schema";
import { plants } from "@/modules/catalog";

export const questionStatus = pgEnum("question_status", ["new", "in_progress", "answered"]);

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => users.id),
  plantId: integer("plant_id").references(() => plants.id),
  status: questionStatus("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

/** Только то, что видит покупатель. Черновики агента сюда не попадают. */
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id")
    .notNull()
    .references(() => questions.id),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id),
  authorRole: userRole("author_role").notNull(),
  body: text("body").notNull(),
  photoPath: text("photo_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

/** Черновик диагноза. Становится сообщением только через approve — точка human review. */
export const answerDrafts = pgTable("answer_drafts", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id")
    .notNull()
    .references(() => questions.id),
  body: text("body").notNull(),
  rationale: text("rationale").notNull(),
  confidence: smallint("confidence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: integer("approved_by").references(() => users.id),
});
