import { describe, expect, it } from "vitest";
import { RulesProvider } from "./rules-provider";
import { HttpProvider } from "./http-provider";
import { callTool, IRREVERSIBLE, makeProvider } from "./runner";

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
