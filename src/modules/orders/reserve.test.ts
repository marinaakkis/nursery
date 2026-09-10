import { and, eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { cleanupTestRows, testName } from "@/db/test-cleanup";
import { users } from "@/db/shared-schema";
import { plants } from "@/modules/catalog";
import { batches, demandFacts } from "@/modules/warehouse";
import { cartItems, orders } from "./schema";
import { createOrder } from "./service";

/** Тесты работают против настоящего Postgres: инварианты живут в схеме,
 *  и проверять их на моках бессмысленно. Без DATABASE_URL блок пропускается —
 *  так же, как шаг миграций в check.sh. */
const hasDb = Boolean(process.env.DATABASE_URL);

const createdPlants: number[] = [];
const createdOrders: number[] = [];
let customerId = 0;

/** Свой покупатель, а не первый из базы: тест не должен трогать корзину
 *  демо-пользователя — перед показом это стоило бы дорого. */
async function makeCustomer() {
  if (customerId) return customerId;
  const [created] = await getDb()
    .insert(users)
    .values({ name: testName("покупатель"), role: "customer" })
    .returning();
  customerId = created.id;
  return customerId;
}

/** Растение с партиями: [{дата, количество}, …] в порядке от старой к новой. */
async function makePlant(batchSpecs: { receivedAt: string; quantity: number }[]) {
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
  createdPlants.push(plant.id);

  const rows = await db
    .insert(batches)
    .values(
      batchSpecs.map((b) => ({
        plantId: plant.id,
        receivedAt: b.receivedAt,
        quantity: b.quantity,
        remaining: b.quantity,
        supplier: "тест",
      })),
    )
    .returning();

  return { plantId: plant.id, batchIds: rows.map((r) => r.id) };
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

describe.skipIf(!hasDb)("резерв остатка при создании заказа", () => {
  it("берёт из партии с самой ранней датой поступления", async () => {
    const db = getDb();
    const customer = await makeCustomer();
    const { plantId, batchIds } = await makePlant([
      { receivedAt: "2026-03-01", quantity: 2 },
      { receivedAt: "2026-08-01", quantity: 5 },
    ]);

    await db.delete(cartItems).where(eq(cartItems.customerId, customer));
    await db.insert(cartItems).values({ customerId: customer, plantId, quantity: 3 });

    const created = await createOrder(
      { method: "pickup", idempotencyKey: `test-oldest-${plantId}` },
      customer,
    );
    expect(created.ok).toBe(true);
    if (created.ok) createdOrders.push(created.data.orderId);

    const left = await db
      .select({ id: batches.id, remaining: batches.remaining })
      .from(batches)
      .where(eq(batches.plantId, plantId))
      .orderBy(batches.receivedAt, batches.id);

    // Старая партия выбрана до нуля, недостающее взято из новой — не наоборот.
    expect(left.find((b) => b.id === batchIds[0])?.remaining).toBe(0);
    expect(left.find((b) => b.id === batchIds[1])?.remaining).toBe(4);

    const reservations = await db.execute<{ batch_id: number; quantity: number }>(
      sql`select batch_id, quantity from order_reservations
          where order_id = ${created.ok ? created.data.orderId : 0} order by batch_id`,
    );
    expect([...reservations].map((r) => r.quantity)).toEqual([2, 1]);
  });

  it("при нехватке заказ не создаётся, остаток цел, а отказ попадает в demand_facts", async () => {
    const db = getDb();
    const customer = await makeCustomer();
    const { plantId } = await makePlant([{ receivedAt: "2026-03-01", quantity: 1 }]);

    await db.delete(cartItems).where(eq(cartItems.customerId, customer));
    await db.insert(cartItems).values({ customerId: customer, plantId, quantity: 5 });

    const created = await createOrder(
      { method: "pickup", idempotencyKey: `test-short-${plantId}` },
      customer,
    );

    expect(created.ok).toBe(false);
    if (!created.ok) expect(created.error.code).toBe("no_stock");

    // Остаток не тронут: транзакция откатилась целиком.
    const [batch] = await db.select().from(batches).where(eq(batches.plantId, plantId));
    expect(batch.remaining).toBe(1);

    // Заказа нет.
    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.idempotencyKey, `test-short-${plantId}`));
    expect(orderRows).toHaveLength(0);

    // А факт неудовлетворённого спроса есть: он писался отдельной транзакцией,
    // уже после отката — иначе откатился бы вместе с заказом.
    const facts = await db
      .select()
      .from(demandFacts)
      .where(and(eq(demandFacts.plantId, plantId), eq(demandFacts.kind, "rejected_no_stock")));
    expect(facts).toHaveLength(1);
    expect(facts[0].quantity).toBe(5);

    // Корзина сохранена: покупателю есть что уменьшить.
    const stillInCart = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.customerId, customer), eq(cartItems.plantId, plantId)));
    expect(stillInCart).toHaveLength(1);
  });
});
