import { describe, expect, it } from "vitest";
import { allowedNext, canTransition, type OrderStatus } from "./transitions";

describe("статусный граф заказа", () => {
  it("ветка после сборки зависит от способа получения", () => {
    expect(allowedNext("assembling", "pickup")).toContain("ready_for_pickup");
    expect(allowedNext("assembling", "pickup")).not.toContain("handed_to_delivery");
    expect(allowedNext("assembling", "delivery")).toContain("handed_to_delivery");
    expect(allowedNext("assembling", "delivery")).not.toContain("ready_for_pickup");
  });

  it("отменить можно всё незавершённое и нельзя завершённое", () => {
    for (const from of ["new", "assembling", "ready_for_pickup", "handed_to_delivery"] as const) {
      expect(canTransition(from, "cancelled", "pickup")).toBe(true);
    }
    expect(canTransition("done", "cancelled", "pickup")).toBe(false);
    expect(canTransition("cancelled", "cancelled", "pickup")).toBe(false);
  });

  it("из выполненного и отменённого переходов нет", () => {
    expect(allowedNext("done", "pickup")).toEqual([]);
    expect(allowedNext("cancelled", "delivery")).toEqual([]);
  });

  it("недопустимые пары отклоняются", () => {
    // Через голову: нельзя выдать заказ, минуя сборку.
    expect(canTransition("new", "ready_for_pickup", "pickup")).toBe(false);
    expect(canTransition("new", "done", "pickup")).toBe(false);
    // Назад тоже нельзя: история переходов не переписывается.
    expect(canTransition("assembling", "new", "pickup")).toBe(false);
    expect(canTransition("done", "assembling", "delivery")).toBe(false);
    // Чужая ветка способа получения.
    expect(canTransition("ready_for_pickup", "handed_to_delivery", "pickup")).toBe(false);
  });

  it("каждый статус объявлен в графе — забытый статус упал бы здесь", () => {
    const all: OrderStatus[] = [
      "new",
      "assembling",
      "ready_for_pickup",
      "handed_to_delivery",
      "done",
      "cancelled",
    ];
    for (const status of all) {
      expect(() => allowedNext(status, "pickup")).not.toThrow();
    }
  });
});
