import { and, eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { users } from "@/db/shared-schema";
import { plants } from "@/modules/catalog";
import { batches, demandFacts } from "@/modules/warehouse";
import { cartItems, orderItems, orders, orderStatusHistory } from "./schema";
import { createOrder } from "./service";

/** Тесты работают против настоящего Postgres: инварианты живут в схеме,
 *  и проверять их на моках бессмысленно. Без DATABASE_URL блок пропускается —
 *  так же, как шаг миграций в check.sh. */
const hasDb = Boolean(process.env.DATABASE_URL);

const createdPlants: number[] = [];
const createdOrders: number[] = [];
let customerId = 0;

async function makeCustomer() {
  if (customerId) return customerId;
  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.role, "customer")).limit(1);
  customerId = existing.id;
  return customerId;
}

/** Растение с партиями: [{дата, количество}, …] в порядке от старой к новой. */
async function makePlant(batchSpecs: { receivedAt: string; quantity: number }[]) {
  const db = getDb();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [plant] = await db
    .insert(plants)
    .values({
      nameRu: `Тестовое растение ${suffix}`,
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
  if (!hasDb || createdPlants.length === 0) return;
  const db = getDb();
  const plantList = sql.join(createdPlants.map((id) => sql`${id}`), sql`, `);

  for (const orderId of createdOrders) {
    await db.execute(sql`delete from order_reservations where order_id = ${orderId}`);
    await db.delete(orderStatusHistory).where(eq(orderStatusHistory.orderId, orderId));
    await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
    await db.delete(orders).where(eq(orders.id, orderId));
  }
  await db.execute(sql`delete from demand_facts where plant_id in (${plantList})`);
  await db.execute(sql`delete from cart_items where plant_id in (${plantList})`);
  await db.execute(sql`delete from batches where plant_id in (${plantList})`);
  await db.execute(sql`delete from plants where id in (${plantList})`);
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
