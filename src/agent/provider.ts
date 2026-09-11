import { z } from "zod";
import { plantFiltersSchema, type PlantFilters } from "@/modules/catalog";

/** Что агент понял из запроса. Провайдер не ходит в базу и не вызывает
 *  инструменты сам: он возвращает намерение, а инструмент вызывает наш код.
 *  Благодаря этому модель без tool-calling подключается без правок остального. */
export type AgentPlan =
  | {
      /** Прямая команда оформить самовывоз. Агент только показывает сводку:
       *  заказ создаётся кнопкой, а не этой фразой. */
      kind: "checkout";
      method: "pickup";
    }
  | {
      kind: "pick";
      filters: PlantFilters;
      /** Как агент прочитал запрос — показывается пользователю дословно. */
      reading: string[];
      /** Что он услышал, но фильтром сделать не может: честно говорим об этом. */
      unsupported: string[];
    }
  | {
      kind: "refuse";
      message: string;
      /** Куда обратиться вместо агента. */
      hint: string;
    };

/**
 * Та же форма, что тип выше, но проверяемая во время выполнения: ответ внешней
 * модели — это текст, и доверять ему без разбора нельзя. Ключ `kind` — единственный
 * способ выбрать ветку; объект вида `{tool, args}` сюда не проходит, потому что
 * провайдер намерений «вызвать инструмент» не возвращает вовсе.
 */
export const agentPlanSchema: z.ZodType<AgentPlan> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("checkout"), method: z.literal("pickup") }),
  z.object({
    kind: z.literal("pick"),
    filters: plantFiltersSchema,
    reading: z.array(z.string()),
    unsupported: z.array(z.string()),
  }),
  z.object({ kind: z.literal("refuse"), message: z.string().min(1), hint: z.string() }),
]);

export interface LlmProvider {
  readonly name: string;
  plan(request: string): Promise<AgentPlan>;
}

export type ProviderKind = "rules" | "http";

export function providerKind(): ProviderKind {
  return process.env.LLM_PROVIDER === "http" ? "http" : "rules";
}

/** Подпись режима для интерфейса — спека §4.3: режим агента виден на экране. */
export function providerLabel(): string {
  if (providerKind() !== "http") return "Подбор: правила";
  const model = process.env.LLM_MODEL?.trim();
  return model ? `Подбор: модель ${model}` : "Подбор: модель не задана";
}
