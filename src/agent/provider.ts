import type { PlantFilters } from "@/modules/catalog";

/** Что агент понял из запроса. Провайдер не ходит в базу и не вызывает
 *  инструменты сам: он возвращает намерение, а инструмент вызывает наш код.
 *  Благодаря этому модель без tool-calling подключается без правок остального. */
export type AgentPlan =
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

export interface LlmProvider {
  readonly name: string;
  plan(request: string): Promise<AgentPlan>;
}

export type ProviderKind = "rules" | "http";

export function providerKind(): ProviderKind {
  return process.env.LLM_PROVIDER === "http" ? "http" : "rules";
}
