import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { cleanupTestRows, testName } from "@/db/test-cleanup";
import { users } from "@/db/shared-schema";
import { plants } from "@/modules/catalog";
import { writeOffs } from "./schema";
import { getStock, receiveBatch, writeOff } from "./service";

const hasDb = Boolean(process.env.DATABASE_URL);

const createdPlants: number[] = [];
const createdUsers: number[] = [];

async function makeKeeper() {
  const [user] = await getDb()
    .insert(users)
    .values({ name: testName("кладовщик"), role: "warehouse" })
    .returning();
  createdUsers.push(user.id);
  return user.id;
}

async function makePlant() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [plant] = await getDb()
    .insert(plants)
    .values({
      nameRu: testName("складское растение"),
      nameLat: `Depositum ${suffix}`,
      description: "Служебная запись теста",
      light: "sun",
      minZone: 4,
      plantingSeason: "spring",
      careLevel: "low",
      soil: "любая",
      priceCents: 30000,
    })
    .returning();
  createdPlants.push(plant.id);
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

describe.skipIf(!hasDb)("приход и списание", () => {
  it("новая партия приходит полной: остаток равен количеству", async () => {
    const plantId = await makePlant();
    const received = await receiveBatch({ plantId, quantity: 12, receivedAt: "2026-03-01", supplier: "тест" });
    if (!received.ok) throw new Error(received.error.message);
    expect(received.data.remaining).toBe(12);

    const stock = await getStock({ plantId });
    if (!stock.ok) throw new Error("остаток не прочитался");
    expect(stock.data.available).toBe(12);
  });

  it("списание уменьшает остаток и оставляет след с причиной", async () => {
    const plantId = await makePlant();
    const keeper = await makeKeeper();
    const received = await receiveBatch({ plantId, quantity: 10, supplier: "тест" });
    if (!received.ok) throw new Error("партия не создалась");

    const done = await writeOff(
      { batchId: received.data.batchId, quantity: 3, reason: "подмёрзли при перевозке" },
      keeper,
    );
    if (!done.ok) throw new Error(done.error.message);
    expect(done.data.remaining).toBe(7);

    const [trace] = await getDb()
      .select({ quantity: writeOffs.quantity, reason: writeOffs.reason })
      .from(writeOffs)
      .where(eq(writeOffs.batchId, received.data.batchId));
    expect(trace.quantity).toBe(3);
    expect(trace.reason).toBe("подмёрзли при перевозке");
  });

  it("списать больше остатка нельзя, и остаток не становится отрицательным", async () => {
    // AC18: отказ внятный, а не падение запроса на ограничении схемы.
    const plantId = await makePlant();
    const keeper = await makeKeeper();
    const received = await receiveBatch({ plantId, quantity: 4, supplier: "тест" });
    if (!received.ok) throw new Error("партия не создалась");

    const result = await writeOff(
      { batchId: received.data.batchId, quantity: 5, reason: "попытка списать лишнее" },
      keeper,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("write_off_exceeds_stock");
    expect(result.error.message).toContain("4");

    const stock = await getStock({ plantId });
    if (!stock.ok) throw new Error("остаток не прочитался");
    expect(stock.data.available).toBe(4);

    const traces = await getDb()
      .select({ id: writeOffs.id })
      .from(writeOffs)
      .where(eq(writeOffs.batchId, received.data.batchId));
    expect(traces).toHaveLength(0);
  });

  it("списание ровно в остаток проходит и обнуляет партию", async () => {
    const plantId = await makePlant();
    const keeper = await makeKeeper();
    const received = await receiveBatch({ plantId, quantity: 6, supplier: "тест" });
    if (!received.ok) throw new Error("партия не создалась");

    const done = await writeOff(
      { batchId: received.data.batchId, quantity: 6, reason: "полная выбраковка" },
      keeper,
    );
    if (!done.ok) throw new Error(done.error.message);
    expect(done.data.remaining).toBe(0);
  });

  it("два одновременных списания не уводят остаток в минус", async () => {
    // Утверждение: из пяти штук два списания по четыре не проходят оба,
    // остаток не уходит в минус, следов ровно столько же, сколько списаний.
    //
    // Честно: снятие `for update` этот тест не роняет — в связке
    // postgres.js + vitest две транзакции сериализуются, и гонки не выходит.
    // Неотрицательность здесь держит ещё и ограничение схемы
    // batches_remaining_nonneg_ck, а блокировка нужна ради внятного отказа
    // вместо падения на ограничении.
    const plantId = await makePlant();
    const keeper = await makeKeeper();
    const received = await receiveBatch({ plantId, quantity: 5, supplier: "тест" });
    if (!received.ok) throw new Error("партия не создалась");

    const [first, second] = await Promise.all([
      writeOff({ batchId: received.data.batchId, quantity: 4, reason: "гонка, первый" }, keeper),
      writeOff({ batchId: received.data.batchId, quantity: 4, reason: "гонка, второй" }, keeper),
    ]);

    // Ровно одно списание проходит: на два по четыре из пяти штук не хватает.
    expect([first.ok, second.ok].filter(Boolean)).toHaveLength(1);

    const stock = await getStock({ plantId });
    if (!stock.ok) throw new Error("остаток не прочитался");
    expect(stock.data.available).toBe(1);

    const traces = await getDb()
      .select({ id: writeOffs.id })
      .from(writeOffs)
      .where(eq(writeOffs.batchId, received.data.batchId));
    expect(traces).toHaveLength(1);
  });

  it("причина списания обязательна", async () => {
    const plantId = await makePlant();
    const keeper = await makeKeeper();
    const received = await receiveBatch({ plantId, quantity: 5, supplier: "тест" });
    if (!received.ok) throw new Error("партия не создалась");

    const result = await writeOff({ batchId: received.data.batchId, quantity: 1, reason: "" }, keeper);
    expect(result.ok).toBe(false);
  });
});
