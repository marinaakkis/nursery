import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "@/modules/consult/photos";
import { photoPathFor } from "@/lib/photo-credits";
/** Демо-данные. Идемпотентен: если в базе уже есть пользователи — выходит, ничего не меняя. */
import { sql } from "drizzle-orm";
import { getDb, getSql } from "@/db/client";
import { notifications, users } from "@/db/shared-schema";
import { careRules, plants } from "@/modules/catalog/schema";
import { batches, demandFacts, writeOffs } from "@/modules/warehouse/schema";
import {
  cartItems,
  deliverySlots,
  orderItems,
  orderReservations,
  orderStatusHistory,
  orders,
} from "@/modules/orders/schema";
import { careEvents, gardenPlants } from "@/modules/garden/schema";
import { answerDrafts, messages, questions } from "@/modules/consult/schema";
import { careRulesByLevel, demoPlants } from "./demo-plants";

const day = (shift: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + shift);
  return d.toISOString().slice(0, 10);
};

/** Значения статуса заказа: тип нужен, чтобы цепочка переходов не выродилась в string[]. */
type OrderStatus = NonNullable<(typeof orders.$inferInsert)["status"]>;

const SLOT_INTERVALS = ["10:00–13:00", "13:00–16:00", "16:00–19:00"];


/** Кладёт снимки каталога в том загрузок под именами демо-фото к вопросам.
 *  Файлы уже лежат в образе (public/plants) и уже атрибутированы в
 *  docs/photo-credits.md — новых лицензий это не добавляет. */
async function putDemoPhotos(
  plan: { from: number; as: string }[],
): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};
  for (const item of plan) {
    const source = path.join(process.cwd(), "public", "plants", `${item.from}.jpg`);
    const target = path.join(UPLOAD_DIR, item.as);
    try {
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(source, target);
      result[item.as] = item.as;
    } catch (error) {
      // Снимок — украшение демо, вопрос важнее: без файла путь остаётся пустым.
      console.warn(`сид: снимок ${item.as} не скопирован`, error);
      result[item.as] = null;
    }
  }
  return result;
}

async function seed() {
  const db = getDb();

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  if (count > 0) {
    console.log("сид пропущен: база не пустая");
    return;
  }

  // --- пользователи: четыре демо-аккаунта переключателя ---
  const [anna, igor, olga, pavel] = await db
    .insert(users)
    .values([
      { name: "Анна", role: "customer" },
      { name: "Игорь", role: "customer" },
      { name: "Ольга", role: "agronomist" },
      { name: "Павел", role: "warehouse" },
    ])
    .returning();

  // --- каталог ---
  // Снимок привязывается по латинскому названию, а не по номеру строки:
  // идентификатор зависит от порядка вставки и однажды уже разъехался.
  const inserted = await db
    .insert(plants)
    .values(demoPlants.map((p) => ({ ...p, photoUrl: photoPathFor(p.nameLat) })))
    .returning({ id: plants.id });
  const plantIds = inserted.map((p) => p.id);

  await db.insert(careRules).values(
    demoPlants.flatMap((p, i) =>
      careRulesByLevel[p.careLevel].map((r) => ({ plantId: plantIds[i], ...r })),
    ),
  );

  // --- партии: у каждого третьего две, у трёх остаток нулевой ---
  const zeroStock = new Set([plantIds[4], plantIds[11], plantIds[20]]);
  const batchRows = plantIds.flatMap((id, i) => {
    if (zeroStock.has(id)) {
      return [{ plantId: id, receivedAt: day(-120), quantity: 6, remaining: 0, supplier: "Северный питомник" }];
    }
    const first = {
      plantId: id,
      receivedAt: day(-90 - (i % 30)),
      quantity: 10 + (i % 5),
      remaining: 3 + (i % 4),
      supplier: "Северный питомник",
    };
    if (i % 3 !== 0) return [first];
    return [
      first,
      { plantId: id, receivedAt: day(-20 - (i % 10)), quantity: 12, remaining: 12, supplier: "Тепличное хозяйство «Луговое»" },
    ];
  });
  const insertedBatches = await db.insert(batches).values(batchRows).returning();

  await db.insert(writeOffs).values([
    { batchId: insertedBatches[0].id, quantity: 1, reason: "подмерз при хранении", actorId: pavel.id },
    { batchId: insertedBatches[3].id, quantity: 2, reason: "пересорт", actorId: pavel.id },
  ]);

  // --- слоты доставки на неделю вперёд ---
  const slots = await db
    .insert(deliverySlots)
    .values(
      [0, 1, 2, 3, 4, 5, 6].flatMap((d) =>
        SLOT_INTERVALS.map((interval) => ({ slotDate: day(d + 1), interval })),
      ),
    )
    .returning();
  // один слот заполнен до вместимости — проверка состояния «слот занят»
  await db.update(deliverySlots).set({ taken: 5 }).where(sql`${deliverySlots.id} = ${slots[0].id}`);

  // --- заказы во всех шести статусах ---
  const orderPlan = [
    { customer: anna.id, status: "new" as const, fulfillment: "pickup" as const, slot: null },
    { customer: anna.id, status: "assembling" as const, fulfillment: "delivery" as const, slot: slots[4].id },
    { customer: igor.id, status: "ready_for_pickup" as const, fulfillment: "pickup" as const, slot: null },
    { customer: igor.id, status: "handed_to_delivery" as const, fulfillment: "delivery" as const, slot: slots[7].id },
    { customer: anna.id, status: "done" as const, fulfillment: "pickup" as const, slot: null },
    { customer: igor.id, status: "cancelled" as const, fulfillment: "pickup" as const, slot: null },
  ];

  const HISTORY: Record<OrderStatus, OrderStatus[]> = {
    new: ["new"],
    assembling: ["new", "assembling"],
    ready_for_pickup: ["new", "assembling", "ready_for_pickup"],
    handed_to_delivery: ["new", "assembling", "handed_to_delivery"],
    done: ["new", "assembling", "ready_for_pickup", "done"],
    cancelled: ["new", "cancelled"],
  };

  for (const [i, plan] of orderPlan.entries()) {
    const plantId = plantIds[i + 1];
    const price = demoPlants[i + 1].priceCents;
    const quantity = 1 + (i % 2);

    const [order] = await db
      .insert(orders)
      .values({
        customerId: plan.customer,
        status: plan.status,
        fulfillment: plan.fulfillment,
        slotId: plan.slot,
        totalCents: price * quantity,
        isPaid: plan.status !== "cancelled",
        idempotencyKey: `seed-order-${i + 1}`,
      })
      .returning();

    await db.insert(orderItems).values({ orderId: order.id, plantId, quantity, priceCents: price });

    // Резерв держат только незавершённые заказы; отменённый вернул своё в партию.
    if (plan.status !== "cancelled" && plan.status !== "done") {
      const batch = insertedBatches.find((b) => b.plantId === plantId && b.remaining > 0);
      if (batch) await db.insert(orderReservations).values({ orderId: order.id, batchId: batch.id, quantity });
    }

    const chain = HISTORY[plan.status];
    await db.insert(orderStatusHistory).values(
      chain.map((to, idx) => ({
        orderId: order.id,
        fromStatus: idx === 0 ? null : chain[idx - 1],
        toStatus: to,
        actorRole: idx === 0 ? "customer" : plan.status === "cancelled" ? "customer" : "warehouse",
      })),
    );

    await db.insert(notifications).values({
      userId: plan.customer,
      kind: "order_status",
      payload: { orderId: order.id, status: plan.status },
      readAt: i % 2 === 0 ? null : new Date(),
    });

    if (plan.status !== "cancelled") {
      await db.insert(demandFacts).values({ plantId, quantity, kind: "sold", occurredAt: new Date() });
    }
  }

  // спрос, который не удалось удовлетворить — из него растёт план закупок
  await db.insert(demandFacts).values([
    { plantId: plantIds[4], quantity: 2, kind: "rejected_no_stock" },
    { plantId: plantIds[11], quantity: 1, kind: "rejected_no_stock" },
  ]);

  // --- корзина: у Игоря непустая, чтобы экран не был пустым на демо ---
  await db.insert(cartItems).values([{ customerId: igor.id, plantId: plantIds[17], quantity: 2 }]);

  // --- сад двух покупателей с событиями в прошлом, сегодня и в будущем ---
  const gardenPlan = [
    { customer: anna.id, plantIdx: 5, quantity: 1, shifts: [-9, -2, 0, 11] },
    { customer: anna.id, plantIdx: 11, quantity: 2, shifts: [-4, 0, 7] },
    { customer: anna.id, plantIdx: 23, quantity: 1, shifts: [3, 17] },
    { customer: igor.id, plantIdx: 9, quantity: 3, shifts: [-6, 0, 5] },
    { customer: igor.id, plantIdx: 14, quantity: 1, shifts: [-1, 13] },
  ];

  for (const g of gardenPlan) {
    const [gp] = await db
      .insert(gardenPlants)
      .values({
        customerId: g.customer,
        plantId: plantIds[g.plantIdx],
        quantity: g.quantity,
        acquiredAt: day(-40),
      })
      .returning();

    await db.insert(careEvents).values(
      g.shifts.map((shift, idx) => {
        // одно прошедшее событие выполнено, остальные прошедшие остаются просроченными
        const done = shift < 0 && idx === 0;
        return {
          gardenPlantId: gp.id,
          type: idx % 2 === 0 ? ("watering" as const) : ("feeding" as const),
          plannedOn: day(shift),
          isDone: done,
          doneOn: done ? day(shift) : null,
        };
      }),
    );
  }

  // --- вопросы консультанту: три у Анны с фото, один с готовым черновиком ---
  // Снимки кладутся в том загрузок прямо здесь: путь в базе без файла на диске
  // дал бы битую картинку на стенде, где том стартует пустым.
  const demoPhotos = await putDemoPhotos([
    { from: 7, as: "demo/hydrangea-spots.jpg" },
    { from: 21, as: "demo/astilbe-wilting.jpg" },
    { from: 16, as: "demo/rosa-aphids.jpg" },
  ]);

  const [q1, q2, q3, q4] = await db
    .insert(questions)
    .values([
      { customerId: anna.id, plantId: plantIds[6], status: "new" },
      { customerId: anna.id, plantId: plantIds[20], status: "new" },
      { customerId: anna.id, plantId: plantIds[15], status: "answered" },
      { customerId: igor.id, plantId: null, status: "in_progress" },
    ])
    .returning();

  await db.insert(messages).values([
    {
      questionId: q1.id,
      authorId: anna.id,
      authorRole: "customer",
      body: "На листьях бурые пятна по краю, появились за неделю. Поливаю раз в три дня.",
      photoPath: demoPhotos["demo/hydrangea-spots.jpg"],
    },
    {
      questionId: q2.id,
      authorId: anna.id,
      authorRole: "customer",
      body: "Астильба вянет к полудню, хотя земля сырая. Посадила этой весной в полутени.",
      photoPath: demoPhotos["demo/astilbe-wilting.jpg"],
    },
    {
      questionId: q3.id,
      authorId: anna.id,
      authorRole: "customer",
      body: "На молодых побегах роз тля, рядом бегают муравьи. Чем обработать?",
      photoPath: demoPhotos["demo/rosa-aphids.jpg"],
    },
    {
      questionId: q3.id,
      authorId: olga.id,
      authorRole: "agronomist",
      body: "Смойте струёй воды и обработайте инсектицидом вечером. Муравейник рядом уберите — иначе тлю принесут снова.",
      photoPath: null,
    },
    {
      questionId: q4.id,
      authorId: igor.id,
      authorRole: "customer",
      body: "Можно ли сажать рябину ближе двух метров к забору?",
      photoPath: null,
    },
  ]);

  // Черновик агента, ещё не одобренный агрономом: точка human review видна на демо.
  await db.insert(answerDrafts).values({
    questionId: q1.id,
    body: "Похоже на «пятна на листьях».\nПохоже на грибковое поражение: пятна и налёт появляются при загущении и сырости, особенно в холодное дождливое лето.\nГортензия метельчатая: место — полутень, почва — влажная слабокислая.\nЧто сделать:\n1. Уберите поражённые листья и не оставляйте их под кустом.\n2. Проредите побеги, чтобы внутри куста был воздух.\n3. Обработайте фунгицидом по инструкции, повторно — через положенный срок.",
    rationale:
      "Совпали признаки: пятна на листьях. Требования растения взяты из карточки: свет — полутень, зона 3, почва — влажная слабокислая. Признак один, разночтений нет.",
    confidence: 2,
  });

  console.log(
    `сид выполнен: пользователей 4, растений ${plantIds.length}, партий ${insertedBatches.length}, заказов ${orderPlan.length}`,
  );
}

seed()
  .then(() => getSql().end())
  .catch(async (error) => {
    console.error("сид упал:", error);
    await getSql().end();
    process.exit(1);
  });
