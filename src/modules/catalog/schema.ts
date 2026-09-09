import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgEnum,
  pgTable,
  serial,
  smallint,
  text,
  unique,
} from "drizzle-orm/pg-core";

export const lightLevel = pgEnum("light_level", ["sun", "partial", "shade"]);
export const plantingSeason = pgEnum("planting_season", ["spring", "autumn", "spring_autumn"]);
export const careLevel = pgEnum("care_level", ["low", "medium", "high"]);
export const careType = pgEnum("care_type", ["watering", "feeding", "pruning"]);

export const plants = pgTable(
  "plants",
  {
    id: serial("id").primaryKey(),
    nameRu: text("name_ru").notNull(),
    nameLat: text("name_lat").notNull(),
    description: text("description").notNull(),
    light: lightLevel("light").notNull(),
    minZone: smallint("min_zone").notNull(),
    plantingSeason: plantingSeason("planting_season").notNull(),
    careLevel: careLevel("care_level").notNull(),
    soil: text("soil").notNull(),
    priceCents: integer("price_cents").notNull(),
    photoUrl: text("photo_url"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    check("plants_min_zone_ck", sql`${t.minZone} between 2 and 6`),
    check("plants_price_ck", sql`${t.priceCents} > 0`),
  ],
);

/** Правила ухода растения: из них строится календарь при попадании растения в сад. */
export const careRules = pgTable(
  "care_rules",
  {
    id: serial("id").primaryKey(),
    plantId: integer("plant_id")
      .notNull()
      .references(() => plants.id),
    type: careType("type").notNull(),
    periodDays: integer("period_days").notNull(),
    seasonOnly: boolean("season_only").notNull().default(false),
  },
  (t) => [
    unique("care_rules_plant_type_uq").on(t.plantId, t.type),
    check("care_rules_period_ck", sql`${t.periodDays} > 0`),
  ],
);
