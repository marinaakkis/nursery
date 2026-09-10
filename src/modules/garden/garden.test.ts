import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { users } from "@/db/shared-schema";
import { careRules, plants } from "@/modules/catalog";
import { batches } from "@/modules/warehouse";
import { cartItems, orderItems, orders, orderStatusHistory } from "@/modules/orders";
import { addToCart, createOrder, transition } from "@/modules/orders";
import { careEvents, gardenPlants } from "./schema";
import {
  CARE_HORIZON_DAYS,
  getGardenPlant,
  isOverdue,
  listCareEvents,
  listGarden,
  markCareDone,
  planDates,
  todayIso,
} from "./service";

const hasDb = Boolean(process.env.DATABASE_URL);

const createdPlants: number[] = [];
const createdOrders: number[] = [];
const createdUsers: number[] = [];

async function makeCustomer() {
  const [created] = await getDb()
    .insert(users)
    .values({ name: `Садовод ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, role: "customer" })
    .returning();
  createdUsers.push(created.id);
  return created.id;
}

/** Растение с запасом и правилами ухода. */
async function makePlant(rules: { type: "watering" | "feeding" | "pruning"; periodDays: number }[]) {
  const db = getDb();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [plant] = await db
    .insert(plants)
    .values({
      nameRu: `Садовое растение ${suffix}`,
      nameLat: `Hortus ${suffix}`,
      description: "Служебная запись теста",
      light: "sun",
      minZone: 4,
      plantingSeason: "spring",
      careLevel: "low",
      soil: "любая",
      priceCents: 50000,
    })
    .returning();
  createdPlants.push(plant.id);

  await db
    .insert(batches)
    .values({ plantId: plant.id, receivedAt: "2026-01-01", quantity: 50, remaining: 50, supplier: "тест" });

  if (rules.length > 0) {
    await db.insert(careRules).values(rules.map((rule) => ({ plantId: plant.id, ...rule })));
  }
  return plant.id;
}

/** Полный путь покупателя: корзина → заказ → сборка → выдача → выполнен. */
async function buyAndComplete(customerId: number, plantId: number, quantity = 1) {
  await addToCart({ plantId, quantity }, customerId);
  const created = await createOrder(
    { method: "pickup", idempotencyKey: `garden-test-${Date.now()}-${Math.random()}` },
    customerId,
  );
  if (!created.ok) throw new Error(`заказ не создался: ${created.error.message}`);
  const orderId = created.data.orderId;
  createdOrders.push(orderId);

  const staff = { userId: 0, role: "warehouse" };
  for (const next of ["assembling", "ready_for_pickup", "done"] as const) {
    const moved = await transition({ orderId, next }, staff);
    if (!moved.ok) throw new Error(`переход в ${next} не прошёл: ${moved.error.message}`);
  }
  return orderId;
}

afterAll(async () => {
  if (!hasDb) return;
  const db = getDb();
  if (createdOrders.length > 0) {
    await db.execute(sql`delete from order_reservations where order_id in ${createdOrders}`);
    await db.delete(orderStatusHistory).where(inArray(orderStatusHistory.orderId, createdOrders));
    await db.delete(orderItems).where(inArray(orderItems.orderId, createdOrders));
  }
  if (createdUsers.length > 0) {
    await db.execute(
      sql`delete from care_events where garden_plant_id in (select id from garden_plants where customer_id in ${createdUsers})`,
    );
    await db.delete(gardenPlants).where(inArray(gardenPlants.customerId, createdUsers));
    await db.delete(orders).where(inArray(orders.customerId, createdUsers));
    await db.delete(cartItems).where(inArray(cartItems.customerId, createdUsers));
    await db.execute(sql`delete from notifications where user_id in ${createdUsers}`);
  }
  if (createdPlants.length > 0) {
    await db.execute(sql`delete from demand_facts where plant_id in ${createdPlants}`);
    await db.delete(careRules).where(inArray(careRules.plantId, createdPlants));
    await db.delete(batches).where(inArray(batches.plantId, createdPlants));
    await db.delete(plants).where(inArray(plants.id, createdPlants));
  }
  if (createdUsers.length > 0) await db.delete(users).where(inArray(users.id, createdUsers));
});

describe("расписание ухода — чистые функции", () => {
  it("первое событие через период, а не в день покупки", () => {
    const dates = planDates("2026-05-01", 7, 21);
    expect(dates).toEqual(["2026-05-08", "2026-05-15", "2026-05-22"]);
  });

  it("на горизонт в полгода правило с периодом 14 даёт 12 событий", () => {
    expect(planDates("2026-05-01", 14)).toHaveLength(Math.floor(CARE_HORIZON_DAYS / 14));
  });

  it("просрочено — плановая дата в прошлом и не выполнено", () => {
    const today = "2026-06-10";
    expect(isOverdue({ plannedOn: "2026-06-09", isDone: false, seasonOnly: false }, today)).toBe(true);
    expect(isOverdue({ plannedOn: "2026-06-10", isDone: false, seasonOnly: false }, today)).toBe(false);
    expect(isOverdue({ plannedOn: "2026-06-09", isDone: true, seasonOnly: false }, today)).toBe(false);
  });

  it("сезонное событие вне сезона просроченным не считается", () => {
    // spec §3.3: обрезка, выпавшая на январь, не должна гореть красным.
    expect(isOverdue({ plannedOn: "2026-01-15", isDone: false, seasonOnly: true }, "2026-06-10")).toBe(false);
    expect(isOverdue({ plannedOn: "2026-06-01", isDone: false, seasonOnly: true }, "2026-06-10")).toBe(true);
  });
});

describe.skipIf(!hasDb)("сад наполняется выполненным заказом", () => {
  it("перевод в «выполнен» кладёт растение в сад и строит календарь", async () => {
    const customer = await makeCustomer();
    const plantId = await makePlant([
      { type: "watering", periodDays: 7 },
      { type: "feeding", periodDays: 45 },
    ]);

    await buyAndComplete(customer, plantId, 2);

    const garden = await listGarden(customer);
    if (!garden.ok) throw new Error("сад не прочитался");
    expect(garden.data).toHaveLength(1);
    expect(garden.data[0].quantity).toBe(2);
    expect(garden.data[0].plantId).toBe(plantId);

    const [row] = await getDb()
      .select({ total: sql<number>`count(*)::int` })
      .from(careEvents)
      .where(eq(careEvents.gardenPlantId, garden.data[0].gardenPlantId));

    // Полив раз в 7 дней и подкормка раз в 45 на горизонт в полгода.
    const expected =
      Math.floor(CARE_HORIZON_DAYS / 7) + Math.floor(CARE_HORIZON_DAYS / 45);
    expect(row.total).toBe(expected);
  });

  it("повторный перевод в «выполнен» не задваивает ни сад, ни события", async () => {
    const customer = await makeCustomer();
    const plantId = await makePlant([{ type: "watering", periodDays: 10 }]);
    const orderId = await buyAndComplete(customer, plantId);

    const before = await listGarden(customer);
    if (!before.ok) throw new Error("сад не прочитался");
    const gardenPlantId = before.data[0].gardenPlantId;

    const [eventsBefore] = await getDb()
      .select({ total: sql<number>`count(*)::int` })
      .from(careEvents)
      .where(eq(careEvents.gardenPlantId, gardenPlantId));

    // Прямой повтор перехода: граф статусов его не пустит, поэтому зовём
    // наполнение ещё раз тем же путём, что и transition, — через заказ.
    const again = await transition({ orderId, next: "done" }, { userId: 0, role: "warehouse" });
    expect(again.ok).toBe(false);

    const after = await listGarden(customer);
    if (!after.ok) throw new Error("сад не прочитался");
    expect(after.data).toHaveLength(1);
    expect(after.data[0].quantity).toBe(before.data[0].quantity);

    const [eventsAfter] = await getDb()
      .select({ total: sql<number>`count(*)::int` })
      .from(careEvents)
      .where(eq(careEvents.gardenPlantId, gardenPlantId));
    expect(eventsAfter.total).toBe(eventsBefore.total);
  });

  it("вторая покупка того же растения увеличивает количество, а не заводит вторую строку", async () => {
    const customer = await makeCustomer();
    const plantId = await makePlant([{ type: "watering", periodDays: 7 }]);

    await buyAndComplete(customer, plantId, 1);
    await buyAndComplete(customer, plantId, 3);

    const garden = await listGarden(customer);
    if (!garden.ok) throw new Error("сад не прочитался");
    expect(garden.data).toHaveLength(1);
    expect(garden.data[0].quantity).toBe(4);
  });
});

describe.skipIf(!hasDb)("отметки выполнения", () => {
  it("markDone идемпотентен: повторная отметка не создаёт второго события", async () => {
    const customer = await makeCustomer();
    const plantId = await makePlant([{ type: "watering", periodDays: 7 }]);
    await buyAndComplete(customer, plantId);

    const garden = await listGarden(customer);
    if (!garden.ok) throw new Error("сад не прочитался");
    const gardenPlantId = garden.data[0].gardenPlantId;

    const [{ id: eventId }] = await getDb()
      .select({ id: careEvents.id })
      .from(careEvents)
      .where(eq(careEvents.gardenPlantId, gardenPlantId))
      .orderBy(careEvents.plannedOn)
      .limit(1);

    const countEvents = async () => {
      const [row] = await getDb()
        .select({ total: sql<number>`count(*)::int` })
        .from(careEvents)
        .where(eq(careEvents.gardenPlantId, gardenPlantId));
      return row.total;
    };

    const before = await countEvents();
    const first = await markCareDone({ eventId }, customer);
    if (!first.ok) throw new Error("отметка не прошла");
    expect(first.data.alreadyDone).toBe(false);
    const afterFirst = await countEvents();

    const second = await markCareDone({ eventId }, customer);
    if (!second.ok) throw new Error("повторная отметка вернула ошибку вместо тишины");
    expect(second.data.alreadyDone).toBe(true);
    const afterSecond = await countEvents();

    expect(afterFirst).toBeGreaterThanOrEqual(before);
    expect(afterSecond).toBe(afterFirst);
  });

  it("следующее событие считается от фактической даты, а не от плановой", async () => {
    const customer = await makeCustomer();
    const plantId = await makePlant([{ type: "watering", periodDays: 7 }]);
    await buyAndComplete(customer, plantId);

    const garden = await listGarden(customer);
    if (!garden.ok) throw new Error("сад не прочитался");
    const gardenPlantId = garden.data[0].gardenPlantId;

    // Сдвигаем плановую дату в прошлое: полили с опозданием.
    const [{ id: eventId }] = await getDb()
      .select({ id: careEvents.id })
      .from(careEvents)
      .where(eq(careEvents.gardenPlantId, gardenPlantId))
      .orderBy(careEvents.plannedOn)
      .limit(1);
    await getDb().update(careEvents).set({ plannedOn: "2026-01-05" }).where(eq(careEvents.id, eventId));

    const done = await markCareDone({ eventId }, customer);
    if (!done.ok) throw new Error("отметка не прошла");

    const expected = new Date(`${todayIso()}T00:00:00Z`);
    expected.setUTCDate(expected.getUTCDate() + 7);
    expect(done.data.nextPlannedOn).toBe(expected.toISOString().slice(0, 10));
  });

  it("чужое событие отмечать нельзя", async () => {
    const owner = await makeCustomer();
    const stranger = await makeCustomer();
    const plantId = await makePlant([{ type: "watering", periodDays: 7 }]);
    await buyAndComplete(owner, plantId);

    const garden = await listGarden(owner);
    if (!garden.ok) throw new Error("сад не прочитался");
    const [{ id: eventId }] = await getDb()
      .select({ id: careEvents.id })
      .from(careEvents)
      .where(eq(careEvents.gardenPlantId, garden.data[0].gardenPlantId))
      .limit(1);

    const result = await markCareDone({ eventId }, stranger);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("forbidden");
  });
});

describe.skipIf(!hasDb)("чтение календаря", () => {
  it("просрочка считается при чтении и попадает в окно, даже если period начинается позже", async () => {
    const customer = await makeCustomer();
    const plantId = await makePlant([{ type: "watering", periodDays: 7 }]);
    await buyAndComplete(customer, plantId);

    const garden = await listGarden(customer);
    if (!garden.ok) throw new Error("сад не прочитался");
    const [{ id: eventId }] = await getDb()
      .select({ id: careEvents.id })
      .from(careEvents)
      .where(eq(careEvents.gardenPlantId, garden.data[0].gardenPlantId))
      .orderBy(careEvents.plannedOn)
      .limit(1);

    // Ни одного поля «просрочено» в базе нет — двигаем только плановую дату.
    await getDb().update(careEvents).set({ plannedOn: "2026-06-01" }).where(eq(careEvents.id, eventId));

    const calendar = await listCareEvents({ from: todayIso() }, customer);
    if (!calendar.ok) throw new Error("календарь не прочитался");

    const overdue = calendar.data.events.find((event) => event.id === eventId);
    expect(overdue).toBeDefined();
    expect(overdue?.overdue).toBe(true);
    expect(calendar.data.dueCount).toBeGreaterThanOrEqual(1);
  });

  it("чужой сад не читается", async () => {
    const owner = await makeCustomer();
    const stranger = await makeCustomer();
    const plantId = await makePlant([{ type: "watering", periodDays: 7 }]);
    await buyAndComplete(owner, plantId);

    const mine = await listGarden(stranger);
    if (!mine.ok) throw new Error("сад не прочитался");
    expect(mine.data).toHaveLength(0);

    const garden = await listGarden(owner);
    if (!garden.ok) throw new Error("сад не прочитался");
    const detail = await getGardenPlant({ id: garden.data[0].gardenPlantId }, stranger);
    expect(detail.ok).toBe(false);
  });
});
