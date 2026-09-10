/** Тон бейджа и подсказка «что дальше» по статусу заказа. Отображение, не логика:
 *  сам граф переходов живёт в orders/service.ts и сюда не дублируется. */

type Tone = "neutral" | "progress" | "success" | "warning" | "danger";

export const STATUS_TONE: Record<string, Tone> = {
  new: "progress",
  assembling: "progress",
  ready_for_pickup: "success",
  handed_to_delivery: "progress",
  done: "success",
  cancelled: "neutral",
};

export function whatNext(status: string, fulfillment: string, slot: string | null): string {
  switch (status) {
    case "new":
      return "Заказ принят. Питомник начнёт сборку — статус изменится на этой странице.";
    case "assembling":
      return fulfillment === "pickup"
        ? "Собираем заказ. Когда всё будет упаковано, статус сменится на «готов к выдаче»."
        : "Собираем заказ. Дальше он уедет в выбранный слот доставки.";
    case "ready_for_pickup":
      return "Заказ готов. Заберите его в питомнике в рабочие часы.";
    case "handed_to_delivery":
      return slot
        ? `Заказ уехал. Курьер привезёт его ${slot}.`
        : "Заказ уехал и едет по выбранному слоту.";
    case "done":
      return "Заказ выполнен. Спасибо за покупку.";
    case "cancelled":
      return "Заказ отменён, растения вернулись в остаток питомника.";
    default:
      return "Статус заказа обновится на этой странице.";
  }
}

const dateTime = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatWhen = (iso: string): string => dateTime.format(new Date(iso));

const dayOnly = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

export function formatSlot(slot: { slotDate: string; interval: string } | null): string | null {
  if (!slot) return null;
  const [year, month, day] = slot.slotDate.split("-").map(Number);
  return `${dayOnly.format(new Date(year, month - 1, day))}, ${slot.interval}`;
}

export type StatusStep = { label: string; state: "done" | "current" | "ahead" };

/**
 * Шкала шагов заказа под его способ получения. Порядок берётся из того же
 * графа, что и переходы: новый → в сборке → выдача либо доставка → выполнен.
 * Отменённый заказ шкалы не имеет — он с неё сошёл.
 */
export function statusSteps(status: string, fulfillment: string): StatusStep[] {
  if (status === "cancelled") return [];

  const middle = fulfillment === "pickup" ? "готов к выдаче" : "передан в доставку";
  const order = ["new", "assembling", fulfillment === "pickup" ? "ready_for_pickup" : "handed_to_delivery", "done"];
  const labels = ["новый", "в сборке", middle, "выполнен"];

  const at = order.indexOf(status);
  return labels.map((label, index) => ({
    label,
    state: index < at ? "done" : index === at ? "current" : "ahead",
  }));
}
