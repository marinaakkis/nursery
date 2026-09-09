import { sql } from "drizzle-orm";
import { boolean, check, date, integer, pgTable, serial, unique } from "drizzle-orm/pg-core";
import { users } from "@/db/shared-schema";
import { careType, plants } from "@/modules/catalog";

/** Одна строка на «покупатель × растение»: повторная покупка — upsert количества. */
export const gardenPlants = pgTable(
  "garden_plants",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => users.id),
    plantId: integer("plant_id")
      .notNull()
      .references(() => plants.id),
    quantity: integer("quantity").notNull(),
    acquiredAt: date("acquired_at").notNull(),
  },
  (t) => [
    unique("garden_plants_customer_plant_uq").on(t.customerId, t.plantId),
    check("garden_plants_quantity_ck", sql`${t.quantity} > 0`),
  ],
);

/** «Просрочено» не хранится: это planned_on < today и is_done = false, считается при чтении. */
export const careEvents = pgTable(
  "care_events",
  {
    id: serial("id").primaryKey(),
    gardenPlantId: integer("garden_plant_id")
      .notNull()
      .references(() => gardenPlants.id),
    type: careType("type").notNull(),
    plannedOn: date("planned_on").notNull(),
    isDone: boolean("is_done").notNull().default(false),
    doneOn: date("done_on"),
  },
  (t) => [
    unique("care_events_plant_type_date_uq").on(t.gardenPlantId, t.type, t.plannedOn),
    check("care_events_done_ck", sql`${t.isDone} = (${t.doneOn} is not null)`),
  ],
);
