import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { cleanupTestRows, testName } from "@/db/test-cleanup";
import { plants } from "@/modules/catalog";
import { batches } from "./schema";
import { getStockMany, LOW_STOCK_THRESHOLD } from "./service";

/** Против настоящего Postgres: агрегат и группировка на моках ничего не доказывают. */
const hasDb = Boolean(process.env.DATABASE_URL);

const created: number[] = [];

async function makePlant(batchQuantities: number[]) {
  const db = getDb();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [plant] = await db
    .insert(plants)
    .values({
      nameRu: testName("растение"),
      nameLat: `Testus ${suffix}`,
      description: "Служебная запись теста",
      light: "sun",
      minZone: 4,
      plantingSeason: "spring",
      careLevel: "low",
      soil: "любая",
      priceCents: 10000,
    })
    .returning();
  created.push(plant.id);

  if (batchQuantities.length > 0) {
    await db.insert(batches).values(
      batchQuantities.map((quantity, index) => ({
        plantId: plant.id,
        receivedAt: `2026-0${index + 1}-01`,
        quantity,
        remaining: quantity,
        supplier: "тест",
      })),
    );
  }

  return plant.id;
}

afterAll(async () => {
  if (!hasDb) return;
  // Уборка в finally и по признаку в данных, а не по массиву идентификаторов:
  // прерванный прогон терял массив вместе с процессом, и записи оставались
  // в каталоге — memory/mistakes/2026-09-10-sluzhebnye-zapisi-v-katologe.md
  try {
    const failed = await cleanupTestRows();
    if (failed.length > 0) throw new Error(`уборка не полная: ${failed.join(", ")}`);
  } finally {
    // Ничего не глотаем молча: незакрытая уборка обязана быть видна в выводе.
  }
});

describe.skipIf(!hasDb)("остатки списком", () => {
  it("складывает партии одного растения и возвращает по строке на каждое", async () => {
    const many = await makePlant([4, 6]);
    const one = await makePlant([2]);

    const result = await getStockMany({ plantIds: [many, one] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(2);
    expect(result.data.find((s) => s.plantId === many)?.available).toBe(10);
    expect(result.data.find((s) => s.plantId === one)?.available).toBe(2);
  });

  it("растение без единой партии не исчезает из ответа, а приходит с нулём", async () => {
    // Самый лёгкий способ потерять «нет в наличии»: group by просто не вернёт
    // строку, и сетка каталога решит, что про это растение ничего не известно.
    const empty = await makePlant([]);
    const stocked = await makePlant([5]);

    const result = await getStockMany({ plantIds: [empty, stocked] });
    if (!result.ok) throw new Error("ожидался успех");

    expect(result.data).toHaveLength(2);
    expect(result.data.find((s) => s.plantId === empty)).toEqual({
      plantId: empty,
      available: 0,
      low: false,
    });
  });

  it("партии с нулевым остатком дают ноль, а не пропуск", async () => {
    const drained = await makePlant([3]);
    await getDb().update(batches).set({ remaining: 0 }).where(eq(batches.plantId, drained));

    const result = await getStockMany({ plantIds: [drained] });
    if (!result.ok) throw new Error("ожидался успех");
    expect(result.data[0]).toEqual({ plantId: drained, available: 0, low: false });
  });

  it("признак «мало осталось» ставится по порогу", async () => {
    const low = await makePlant([LOW_STOCK_THRESHOLD]);
    const enough = await makePlant([LOW_STOCK_THRESHOLD + 1]);

    const result = await getStockMany({ plantIds: [low, enough] });
    if (!result.ok) throw new Error("ожидался успех");
    expect(result.data.find((s) => s.plantId === low)?.low).toBe(true);
    expect(result.data.find((s) => s.plantId === enough)?.low).toBe(false);
  });

  it("принимает строку из HTTP и повторы не дублируют строк", async () => {
    const id = await makePlant([7]);
    const result = await getStockMany({ plantIds: `${id},${id}` });
    if (!result.ok) throw new Error("ожидался успех");
    expect(result.data).toEqual([{ plantId: id, available: 7, low: false }]);
  });

  it("пустой список отклоняется, а не выбирает всю таблицу", async () => {
    const result = await getStockMany({ plantIds: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation_failed");
  });

  it("отдаёт только запрошенное и не приносит соседей", async () => {
    const asked = await makePlant([1]);
    await makePlant([9]);

    const result = await getStockMany({ plantIds: [asked] });
    if (!result.ok) throw new Error("ожидался успех");
    expect(result.data.map((s) => s.plantId)).toEqual([asked]);
  });
});
