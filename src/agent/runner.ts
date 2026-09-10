import { toolsByName } from "./registry";
import { HttpProvider } from "./http-provider";
import { RulesProvider } from "./rules-provider";
import { providerKind, type LlmProvider } from "./provider";
import type { ToolContext } from "./types";
import type { Result } from "@/lib/result";
import type { PlantFilters } from "@/modules/catalog";

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
  /** Чем пришлось поступиться, чтобы это растение попало в подборку.
   *  У точных совпадений пусто — иначе покупатель не отличит одно от другого. */
  relaxedBy?: string;
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

/** Ниже какого числа предложений начинаем ослаблять условия. */
export const MIN_SUGGESTIONS = 3;
/** Больше пяти в одной подборке не показываем: это не выдача каталога. */
export const MAX_SUGGESTIONS = 5;

/** Соседние значения по шкале «солнце — полутень — тень». */
const LIGHT_NEIGHBOURS: Record<string, string[]> = {
  sun: ["partial"],
  shade: ["partial"],
  partial: ["shade", "sun"],
};

export type Relaxation = { label: string; filters: PlantFilters };

/**
 * Порядок уступок при недоборе: сначала уход, потом свет на соседнее значение,
 * потом зона на единицу теплее. Каждая следующая ступень строится поверх
 * предыдущей — иначе шаги отменяли бы друг друга.
 *
 * Почему такой порядок: уровень ухода — предпочтение, его нарушение ничем
 * не грозит; свет на соседнее значение растение обычно переносит; зона
 * теплее на единицу — уже риск вымерзания, поэтому она последняя.
 */
export function relaxationPlan(filters: PlantFilters): Relaxation[] {
  const steps: Relaxation[] = [];
  let current: PlantFilters = { ...filters };

  if (current.care) {
    current = { ...current, care: undefined };
    steps.push({ label: "любой уровень ухода", filters: current });
  }

  for (const neighbour of LIGHT_NEIGHBOURS[current.light ?? ""] ?? []) {
    current = { ...current, light: neighbour as PlantFilters["light"] };
    steps.push({ label: LIGHT_WORD[neighbour], filters: current });
  }

  if (current.zone !== undefined && current.zone < 6) {
    current = { ...current, zone: current.zone + 1 };
    steps.push({ label: `зона ${current.zone}`, filters: current });
  }

  return steps;
}

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

  const suggestions: Suggestion[] = [];
  const seen = new Set<number>();

  /** Проверяет наличие по каждому кандидату и берёт то, что реально есть.
   *  Закончившееся не предлагаем: это враньё, а не подбор. */
  async function take(items: PlantListItem[], relaxedBy?: string): Promise<number> {
    let taken = 0;
    for (const plant of items) {
      if (suggestions.length >= MAX_SUGGESTIONS) break;
      if (seen.has(plant.id)) continue;
      seen.add(plant.id);

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
          relaxedBy,
        });
        taken += 1;
      }
    }
    return taken;
  }

  const exactItems = (found.data as { items: PlantListItem[] }).items;
  await take(exactItems);
  const exactCount = suggestions.length;
  const givenUp: string[] = [];

  // Недобор: уступаем по одному условию за шаг, пока не наберём минимум.
  if (suggestions.length < MIN_SUGGESTIONS) {
    for (const relaxation of relaxationPlan(plan.filters)) {
      if (suggestions.length >= MIN_SUGGESTIONS) break;

      const wider = await callTool("catalog.search_plants", relaxation.filters, ctx);
      if (!wider.ok) break;

      // Шаг встаёт в карточку до проверок наличия, которые он вызвал: иначе
      // читается так, будто растения появились сами по себе.
      const step: AgentStep = {
        tool: "catalog.search_plants",
        title: `Ослабил условие: ${relaxation.label}`,
        args: `под точные условия нашлось ${exactCount}`,
        result: "",
      };
      steps.push(step);

      const added = await take((wider.data as { items: PlantListItem[] }).items, relaxation.label);
      givenUp.push(relaxation.label);
      step.result = added > 0 ? `допустил ${relaxation.label} — ещё ${added}` : "ничего нового";
    }
  }

  if (suggestions.length === 0) {
    return {
      kind: "nothing",
      message:
        exactItems.length === 0
          ? "Под такие условия в каталоге сейчас ничего нет."
          : "Всё, что подошло по условиям, закончилось на складе — даже после уступок.",
      hint: "Снимите одно из условий — например, зону или уход — и попробуйте ещё раз.",
      steps,
      suggestions: [],
    };
  }

  const parts = [`Прочитал так: ${describeFilters(plan.reading)}.`];
  if (plan.unsupported.length > 0) {
    parts.push(`Не могу отфильтровать ${plan.unsupported.join("; ")}.`);
  }

  if (givenUp.length > 0) {
    parts.push(
      `Под точные условия нашлось ${exactCount}, поэтому уступил: ${givenUp.join(", ")}.` +
        " Уступки помечены у каждого растения.",
    );
  }

  parts.push(
    suggestions.length === 1
      ? "Подошло одно растение."
      : `Подошло ${suggestions.length} — вот они, с наличием на складе.`,
  );

  return { kind: "picked", message: parts.join(" "), steps, suggestions };
}
