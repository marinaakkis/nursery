/** Статусный граф заказа. Живёт в коде, а не в схеме: допустимая ветка после
 *  сборки зависит от способа получения, и выразить это ограничением дороже,
 *  чем проверить в одном месте — ADR-0002, docs/architecture.md §2. */

export type OrderStatus =
  | "new"
  | "assembling"
  | "ready_for_pickup"
  | "handed_to_delivery"
  | "done"
  | "cancelled";

export type Fulfillment = "pickup" | "delivery";

/** Куда можно уйти из статуса, не считая отмены. Ветка после сборки — по способу. */
const FORWARD: Record<OrderStatus, (f: Fulfillment) => OrderStatus[]> = {
  new: () => ["assembling"],
  assembling: (f) => (f === "pickup" ? ["ready_for_pickup"] : ["handed_to_delivery"]),
  ready_for_pickup: () => ["done"],
  handed_to_delivery: () => ["done"],
  done: () => [],
  cancelled: () => [],
};

/** Отменить можно всё, что ещё не завершено и не отменено. */
const CANCELLABLE: OrderStatus[] = ["new", "assembling", "ready_for_pickup", "handed_to_delivery"];

export function allowedNext(from: OrderStatus, fulfillment: Fulfillment): OrderStatus[] {
  const next = FORWARD[from](fulfillment);
  return CANCELLABLE.includes(from) ? [...next, "cancelled"] : next;
}

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  fulfillment: Fulfillment,
): boolean {
  return allowedNext(from, fulfillment).includes(to);
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "новый",
  assembling: "в сборке",
  ready_for_pickup: "готов к выдаче",
  handed_to_delivery: "передан в доставку",
  done: "выполнен",
  cancelled: "отменён",
};
