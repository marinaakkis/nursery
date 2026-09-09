import { and, asc, eq, lte, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { fail, ok, type Result } from "@/lib/result";
import { plants } from "./schema";

export const plantFiltersSchema = z.object({
  light: z.enum(["sun", "partial", "shade"]).optional(),
  /** Зона участка покупателя: подходят растения с minZone <= zone. */
  zone: z.coerce.number().int().min(2).max(6).optional(),
  season: z.enum(["spring", "autumn", "spring_autumn"]).optional(),
  care: z.enum(["low", "medium", "high"]).optional(),
});

export type PlantFilters = z.infer<typeof plantFiltersSchema>;

export type PlantListItem = {
  id: number;
  nameRu: string;
  nameLat: string;
  light: string;
  minZone: number;
  plantingSeason: string;
  careLevel: string;
  priceCents: number;
};

export async function searchPlants(
  raw: unknown,
): Promise<Result<{ total: number; items: PlantListItem[] }>> {
  const parsed = plantFiltersSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("validation_failed", "Неизвестное значение фильтра", parsed.error.issues);
  }
  const f = parsed.data;

  const conditions: SQL[] = [eq(plants.isActive, true)];
  if (f.light) conditions.push(eq(plants.light, f.light));
  if (f.zone !== undefined) conditions.push(lte(plants.minZone, f.zone));
  if (f.season) conditions.push(eq(plants.plantingSeason, f.season));
  if (f.care) conditions.push(eq(plants.careLevel, f.care));

  const where = and(...conditions);
  const db = getDb();

  const items = await db
    .select({
      id: plants.id,
      nameRu: plants.nameRu,
      nameLat: plants.nameLat,
      light: plants.light,
      minZone: plants.minZone,
      plantingSeason: plants.plantingSeason,
      careLevel: plants.careLevel,
      priceCents: plants.priceCents,
    })
    .from(plants)
    .where(where)
    .orderBy(asc(plants.nameRu));

  const [counted] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(plants)
    .where(where);

  return ok({ total: counted?.total ?? items.length, items });
}
