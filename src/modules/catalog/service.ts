import { and, asc, eq, lte, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getDb, getSql } from "@/db/client";
import { fail, ok, type Result } from "@/lib/result";
import { careRules, plants } from "./schema";

export const plantFiltersSchema = z.object({
  light: z.enum(["sun", "partial", "shade"]).optional(),
  /** Зона участка покупателя: подходят растения с minZone <= zone. */
  zone: z.coerce.number().int().min(2).max(6).optional(),
  season: z.enum(["spring", "autumn", "spring_autumn"]).optional(),
  care: z.enum(["low", "medium", "high"]).optional(),
});

export type PlantFilters = z.infer<typeof plantFiltersSchema>;

const RU_COLLATION = "ru-RU-x-icu";

/** Есть ли в базе русская ICU-коллация. Проверяется один раз: на стенде образ БД
 *  может быть собран без ICU, и жёсткая ссылка на коллацию уронила бы запрос. */
let ruCollation: Promise<boolean> | null = null;

function hasRuCollation(): Promise<boolean> {
  if (!ruCollation) {
    ruCollation = getSql()`select 1 from pg_collation where collname = ${RU_COLLATION} limit 1`
      .then((rows) => rows.length > 0)
      .catch(() => false);
  }
  return ruCollation;
}

export type PlantListItem = {
  id: number;
  nameRu: string;
  nameLat: string;
  photoUrl: string | null;
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

  const collated = await hasRuCollation();

  const items = await db
    .select({
      id: plants.id,
      nameRu: plants.nameRu,
      nameLat: plants.nameLat,
      photoUrl: plants.photoUrl,
      light: plants.light,
      minZone: plants.minZone,
      plantingSeason: plants.plantingSeason,
      careLevel: plants.careLevel,
      priceCents: plants.priceCents,
    })
    .from(plants)
    .where(where)
    // Сортировка по русскому алфавиту: коллация в БД, иначе — на сервере после выборки.
    .orderBy(collated ? sql`${plants.nameRu} collate "ru-RU-x-icu"` : plants.nameRu);

  if (!collated) items.sort((a, b) => a.nameRu.localeCompare(b.nameRu, "ru"));

  const [counted] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(plants)
    .where(where);

  return ok({ total: counted?.total ?? items.length, items });
}

export const plantIdSchema = z.object({ id: z.coerce.number().int().positive() });

export type CareRule = { type: string; periodDays: number; seasonOnly: boolean };

export type PlantCard = {
  id: number;
  nameRu: string;
  nameLat: string;
  photoUrl: string | null;
  description: string;
  light: string;
  minZone: number;
  plantingSeason: string;
  careLevel: string;
  soil: string;
  priceCents: number;
  isActive: boolean;
  careRules: CareRule[];
};

/** Полная карточка растения: требования, описание, правила ухода.
 *  🔶 Наличие сюда не входит — его отдаёт warehouse.getStock отдельным вызовом.
 *  Причина техническая: схема warehouse уже импортирует catalog, и обращение
 *  обратно замкнуло бы модули в цикл. */
export async function getPlant(raw: unknown): Promise<Result<PlantCard>> {
  const parsed = plantIdSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("validation_failed", "Неверный идентификатор растения", parsed.error.issues);
  }

  const db = getDb();
  const [plant] = await db.select().from(plants).where(eq(plants.id, parsed.data.id)).limit(1);
  if (!plant) return fail("not_found", "Такого растения нет в каталоге");

  const rules = await db
    .select({
      type: careRules.type,
      periodDays: careRules.periodDays,
      seasonOnly: careRules.seasonOnly,
    })
    .from(careRules)
    .where(eq(careRules.plantId, plant.id))
    .orderBy(asc(careRules.type));

  return ok({
    id: plant.id,
    nameRu: plant.nameRu,
    nameLat: plant.nameLat,
    description: plant.description,
    light: plant.light,
    minZone: plant.minZone,
    plantingSeason: plant.plantingSeason,
    careLevel: plant.careLevel,
    soil: plant.soil,
    priceCents: plant.priceCents,
    photoUrl: plant.photoUrl,
    // Снятое с продажи растение остаётся читаемым: карточка не ломается,
    // меняется только доступность действия — см. spec §3.1.
    isActive: plant.isActive,
    careRules: rules,
  });
}
