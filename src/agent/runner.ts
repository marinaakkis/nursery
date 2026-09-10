import { toolsByName } from "./registry";
import { HttpProvider } from "./http-provider";
import { RulesProvider } from "./rules-provider";
import { providerKind, type LlmProvider } from "./provider";
import type { ToolContext } from "./types";
import type { Result } from "@/lib/result";

/**
 * Исполнитель агента. Провайдер только читает запрос; инструменты вызывает
 * этот код — через реестр, теми же функциями, что зовёт интерфейс.
 *
 * Необратимые инструменты закрыты воротами: без явного подтверждения человека
 * они не вызываются вообще, и обойти это текстом запроса нельзя.
 */
export const IRREVERSIBLE = new Set(["orders.add_to_cart", "orders.create_order"]);

/** Шаг агента для карточки «что сделал»: инструмент, аргументы и результат по-русски. */
export type AgentStep = { tool: string; title: string; args: string; result: string };

export type Suggestion = {
  plantId: number;
  nameRu: string;
  nameLat: string;
  priceCents: number;
  available: number;
  why: string;
};

export type AgentAnswer = {
  kind: "picked" | "refused" | "nothing";
  message: string;
  hint?: string;
  steps: AgentStep[];
  suggestions: Suggestion[];
};

type PlantListItem = {
  id: number;
  nameRu: string;
  nameLat: string;
  light: string;
  minZone: number;
  plantingSeason: string;
  careLevel: string;
  priceCents: number;
};

const LIGHT_WORD: Record<string, string> = { sun: "солнце", partial: "полутень", shade: "тень" };
const SEASON_WORD: Record<string, string> = {
  spring: "посадка весной",
  autumn: "посадка осенью",
  spring_autumn: "посадка весной или осенью",
};
const CARE_WORD: Record<string, string> = { low: "уход низкий", medium: "уход средний", high: "уход высокий" };

export function makeProvider(): LlmProvider {
  return providerKind() === "http" ? new HttpProvider() : new RulesProvider();
}

/**
 * Вызов инструмента через реестр. Единственная точка, где агент касается данных.
 * `confirmed` приходит от кнопки в интерфейсе, а не из текста запроса.
 */
export async function callTool(
  name: string,
  args: unknown,
  ctx: ToolContext,
  confirmed = false,
): Promise<Result<unknown>> {
  const tool = toolsByName.get(name);
  if (!tool) return { ok: false, error: { code: "not_found", message: `Нет инструмента ${name}` } };

  if (IRREVERSIBLE.has(name) && !confirmed) {
    return {
      ok: false,
      error: {
        code: "forbidden",
        message: "Это действие агент выполняет только после подтверждения кнопкой",
      },
    };
  }

  return tool.handler(args, ctx);
}

const describeFilters = (reading: string[]): string =>
  reading.length > 0 ? reading.join(", ") : "без ограничений";

/** Почему именно это растение — собирается из его же требований, не выдумывается. */
function whyThis(plant: PlantListItem): string {
  return [LIGHT_WORD[plant.light], `зона ${plant.minZone} и теплее`, SEASON_WORD[plant.plantingSeason], CARE_WORD[plant.careLevel]]
    .filter(Boolean)
    .join(" · ");
}

export async function ask(request: string, ctx: ToolContext): Promise<AgentAnswer> {
  const provider = makeProvider();
  const plan = await provider.plan(request);

  if (plan.kind === "refuse") {
    return { kind: "refused", message: plan.message, hint: plan.hint, steps: [], suggestions: [] };
  }

  const steps: AgentStep[] = [];

  const found = await callTool("catalog.search_plants", plan.filters, ctx);
  steps.push({
    tool: "catalog.search_plants",
    title: "Искал в каталоге",
    args: describeFilters(plan.reading),
    result: found.ok
      ? `нашлось ${(found.data as { total: number }).total}`
      : `не получилось: ${found.error.message}`,
  });

  if (!found.ok) {
    return {
      kind: "nothing",
      message: "Каталог не ответил, подобрать не вышло.",
      hint: "Попробуйте повторить запрос — фильтры сохранятся.",
      steps,
      suggestions: [],
    };
  }

  const items = (found.data as { items: PlantListItem[] }).items;
  const suggestions: Suggestion[] = [];

  // Наличие проверяется по каждому кандидату: предлагать то, чего нет, — вранье.
  for (const plant of items) {
    if (suggestions.length >= 5) break;

    const stock = await callTool("warehouse.get_stock", { plantId: plant.id }, ctx);
    const available = stock.ok ? (stock.data as { available: number }).available : 0;
    steps.push({
      tool: "warehouse.get_stock",
      title: `Проверил наличие: ${plant.nameRu}`,
      args: `растение №${plant.id}`,
      result: available > 0 ? `в наличии ${available}` : "нет в наличии",
    });

    if (available > 0) {
      suggestions.push({
        plantId: plant.id,
        nameRu: plant.nameRu,
        nameLat: plant.nameLat,
        priceCents: plant.priceCents,
        available,
        why: whyThis(plant),
      });
    }
  }

  if (suggestions.length === 0) {
    return {
      kind: "nothing",
      message:
        items.length === 0
          ? "Под такие условия в каталоге сейчас ничего нет."
          : "Всё, что подошло по условиям, закончилось на складе.",
      hint: "Снимите одно из условий — например, зону или уход — и попробуйте ещё раз.",
      steps,
      suggestions: [],
    };
  }

  const parts = [`Прочитал так: ${describeFilters(plan.reading)}.`];
  if (plan.unsupported.length > 0) {
    parts.push(`Не могу отфильтровать ${plan.unsupported.join("; ")}.`);
  }
  parts.push(
    suggestions.length === 1
      ? "Подошло одно растение."
      : `Подошло ${suggestions.length} — вот они, с наличием на складе.`,
  );

  return { kind: "picked", message: parts.join(" "), steps, suggestions };
}
