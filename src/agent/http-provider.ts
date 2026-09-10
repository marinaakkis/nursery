import type { AgentPlan, LlmProvider } from "./provider";

/**
 * Провайдер поверх внешней языковой модели. Интерфейс объявлен, реализации нет:
 * продукт демонстрируется и тестируется на детерминированном провайдере, а этот —
 * точка расширения. Когда он появится, менять придётся только этот файл:
 * остальная система знает лишь про LlmProvider и AgentPlan.
 *
 * Молча деградировать в rules нельзя: если стенд поднят с LLM_PROVIDER=http,
 * человек должен увидеть внятную причину, а не тихо другой алгоритм подбора.
 */
export class HttpProvider implements LlmProvider {
  readonly name = "http";

  async plan(): Promise<AgentPlan> {
    return {
      kind: "refuse",
      message:
        "Подбор через внешнюю модель пока не подключён: переменная LLM_PROVIDER=http, а реализации за ней нет.",
      hint: "Поставьте LLM_PROVIDER=rules — встроенный подбор работает без сети.",
    };
  }
}
