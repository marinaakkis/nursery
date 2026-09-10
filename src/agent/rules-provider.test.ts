import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/shared-schema";
import { plants } from "@/modules/catalog";
import { batches } from "@/modules/warehouse";
import { cartItems, orders } from "@/modules/orders";
import { RulesProvider } from "./rules-provider";
import { HttpProvider } from "./http-provider";
import { ask, callTool, IRREVERSIBLE, makeProvider, relaxationPlan } from "./runner";

const provider = new RulesProvider();
const ctx = { userId: 1, role: "customer" as const };

describe("rules-провайдер: разбор запроса в фильтры", () => {
  it("«тень, глина, север, цветение всё лето, без ухода по будням»", async () => {
    const plan = await provider.plan("тень, глина, север, цветение всё лето, без ухода по будням");
    expect(plan.kind).toBe("pick");
    if (plan.kind !== "pick") return;

    expect(plan.filters).toEqual({ light: "shade", care: "low", zone: 3 });
    // Про почву и срок цветения агент говорит честно: фильтров таких нет.
    const notes = plan.unsupported.join(" ");
    expect(notes).toContain("почве");
    expect(notes).toContain("долгое цветение");
  });

  it("«солнечный участок в Подмосковье, сажать весной»", async () => {
    const plan = await provider.plan("солнечный участок в Подмосковье, сажать весной");
    expect(plan.kind).toBe("pick");
    if (plan.kind !== "pick") return;
    expect(plan.filters).toEqual({ light: "sun", season: "spring", zone: 4 });
  });

  it("«полутень, зона 5, готов ухаживать»", async () => {
    const plan = await provider.plan("полутень, зона 5, готов ухаживать");
    expect(plan.kind).toBe("pick");
    if (plan.kind !== "pick") return;
    // Зона числом побеждает регион, даже если регион тоже упомянут.
    expect(plan.filters).toEqual({ light: "partial", care: "high", zone: 5 });
  });

  it("зона числом имеет приоритет над регионом", async () => {
    const plan = await provider.plan("Сибирь, но у меня зона 4");
    if (plan.kind !== "pick") throw new Error("ожидался подбор");
    expect(plan.filters.zone).toBe(4);
  });
});

describe("синонимы трудозатрат", () => {
  const cases: [string, "low" | "medium" | "high"][] = [
    ["хочу что-то простое", "low"],
    ["лёгкий в уходе куст", "low"],
    ["неприхотливое растение", "low"],
    ["без ухода, некогда возиться", "low"],
    ["чтобы рос сам", "low"],
    ["средний уход, готова поливать", "medium"],
    ["умеренный уход", "medium"],
    ["готов ухаживать, хоть капризное", "high"],
    ["требовательное растение не пугает", "high"],
  ];

  for (const [phrase, expected] of cases) {
    it(`«${phrase}» → ${expected}`, async () => {
      const plan = await provider.plan(phrase);
      expect(plan.kind).toBe("pick");
      if (plan.kind !== "pick") return;
      expect(plan.filters.care).toBe(expected);
    });
  }

  it("порядок групп не путает простое со сложным", async () => {
    // «Несложный» содержит «сложн» — если проверять группы не по порядку,
    // фраза уедет в high. Ловушка настоящая, поймана на этой же строке.
    const plan = await provider.plan("несложное растение для полутени");
    if (plan.kind !== "pick") throw new Error("ожидался подбор");
    expect(plan.filters.care).toBe("low");
  });
});

describe("rules-провайдер: отказ вне зоны", () => {
  it("вопрос про болезнь уводит к агроному, а не пытается лечить", async () => {
    const plan = await provider.plan("у гортензии желтеют листья и пятна, что с ней?");
    expect(plan.kind).toBe("refuse");
    if (plan.kind !== "refuse") return;
    expect(plan.message).not.toContain("зона");
    expect(plan.hint).toContain("агроном");
  });

  it("вопрос про доставку уводит на оформление", async () => {
    const plan = await provider.plan("вы доставите в другой город на следующей неделе?");
    expect(plan.kind).toBe("refuse");
    if (plan.kind !== "refuse") return;
    expect(plan.hint).toContain("оформления");
  });

  it("запрос вообще не по теме получает отказ, а не случайную выдачу", async () => {
    const plan = await provider.plan("какая завтра погода в Казани");
    expect(plan.kind).toBe("refuse");
  });
});

describe("http-провайдер — заглушка с внятной причиной", () => {
  it("не деградирует молча в rules, а называет причину", async () => {
    const plan = await new HttpProvider().plan();
    expect(plan.kind).toBe("refuse");
    if (plan.kind !== "refuse") return;
    expect(plan.message).toContain("LLM_PROVIDER");
    expect(plan.hint).toContain("rules");
  });
});

describe("команда оформить самовывоз", () => {
  it("узнаётся и не превращается в подбор", async () => {
    for (const phrase of ["оформляй самовывозом", "оформи самовывоз", "оформить самовывозом, пожалуйста"]) {
      const plan = await provider.plan(phrase);
      expect(plan.kind, phrase).toBe("checkout");
    }
  });

  it.skipIf(!process.env.DATABASE_URL)(
    "фраза в чате доводит до сводки, но заказа в базе не появляется",
    async () => {
      const db = getDb();

      // Корзина обязана быть непустой, иначе проверка вырождается: заказ
      // не создался бы и у сломанного агента. Ловушка проверена диверсией.
      const [customer] = await db
        .insert(users)
        .values({ name: `Проверка ворот ${Date.now()}`, role: "customer" })
        .returning();
      const [plant] = await db.select({ id: plants.id }).from(plants).limit(1);
      await db.insert(batches).values({
        plantId: plant.id,
        receivedAt: "2026-01-01",
        quantity: 5,
        remaining: 5,
        supplier: "тест ворот",
      });
      await db.insert(cartItems).values({ customerId: customer.id, plantId: plant.id, quantity: 1 });

      const ctx = { userId: customer.id, role: "customer" as const };
      const before = await db.select({ n: sql<number>`count(*)::int` }).from(orders);

      const answer = await ask("оформляй самовывозом", ctx);

      const after = await db.select({ n: sql<number>`count(*)::int` }).from(orders);
      expect(after[0].n).toBe(before[0].n);
      expect(answer.kind).toBe("checkout");
      expect(answer.steps.every((step) => step.tool !== "orders.create_order")).toBe(true);

      await db.delete(cartItems).where(eq(cartItems.customerId, customer.id));
      await db.execute(sql`delete from batches where supplier = 'тест ворот'`);
      await db.delete(users).where(eq(users.id, customer.id));
    },
  );
});

describe("ослабление фильтров при недоборе", () => {
  it("первая уступка — уход: это предпочтение, а не свойство участка", () => {
    const steps = relaxationPlan({ light: "shade", care: "low", zone: 3 });
    expect(steps[0].label).toBe("любые трудозатраты");
    expect(steps[0].filters.care).toBeUndefined();
    // Остальное на первом шаге не трогается.
    expect(steps[0].filters.light).toBe("shade");
    expect(steps[0].filters.zone).toBe(3);
  });

  it("вторая уступка — свет на соседнее значение, поверх первой", () => {
    const steps = relaxationPlan({ light: "shade", care: "low", zone: 3 });
    expect(steps[1].label).toBe("полутень");
    expect(steps[1].filters.light).toBe("partial");
    // Уступки накапливаются: уход уже отпущен и обратно не возвращается.
    expect(steps[1].filters.care).toBeUndefined();
  });

  it("зона идёт последней и только на единицу теплее", () => {
    const steps = relaxationPlan({ light: "shade", care: "low", zone: 3 });
    const last = steps[steps.length - 1];
    expect(last.label).toBe("зона 4");
    expect(last.filters.zone).toBe(4);
  });

  it("у полутени два соседних значения, у крайних — одно", () => {
    expect(relaxationPlan({ light: "partial" }).map((s) => s.label)).toEqual(["тень", "солнце"]);
    expect(relaxationPlan({ light: "sun" }).map((s) => s.label)).toEqual(["полутень"]);
  });

  it("уступать нечего, если условий не было", () => {
    expect(relaxationPlan({})).toEqual([]);
  });

  it("зона 6 не растёт дальше — теплее в каталоге ничего нет", () => {
    expect(relaxationPlan({ zone: 6 })).toEqual([]);
  });
});

describe("выбор провайдера по переменной окружения", () => {
  it("по умолчанию и при rules берётся детерминированный", () => {
    delete process.env.LLM_PROVIDER;
    expect(makeProvider().name).toBe("rules");
    process.env.LLM_PROVIDER = "rules";
    expect(makeProvider().name).toBe("rules");
  });

  it("при http берётся http и молча не подменяется на rules", () => {
    process.env.LLM_PROVIDER = "http";
    expect(makeProvider().name).toBe("http");
    delete process.env.LLM_PROVIDER;
  });
});

describe("ворота подтверждения", () => {
  it("необратимые инструменты перечислены явно", () => {
    expect([...IRREVERSIBLE].sort()).toEqual(["orders.add_to_cart", "orders.create_order"]);
  });

  it("add_to_cart без подтверждения не вызывается — до базы дело не доходит", async () => {
    const result = await callTool("orders.add_to_cart", { plantId: 1, quantity: 1 }, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("forbidden");
    expect(result.error.message).toContain("подтверждения");
  });

  it("create_order без подтверждения не вызывается", async () => {
    const result = await callTool("orders.create_order", { method: "pickup" }, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("forbidden");
  });

  it("читающий инструмент воротами не закрыт", () => {
    expect(IRREVERSIBLE.has("catalog.search_plants")).toBe(false);
    expect(IRREVERSIBLE.has("warehouse.get_stock")).toBe(false);
  });
});
