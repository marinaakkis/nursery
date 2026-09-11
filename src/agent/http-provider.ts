import { z } from "zod";
import { allTools } from "./registry";
import { agentPlanSchema, type AgentPlan, type LlmProvider } from "./provider";

/**
 * Провайдер поверх внешней языковой модели через корпоративный gateway
 * (формат OpenAI chat completions). Вход и выход те же, что у rules: текст
 * запроса → AgentPlan. Инструменты провайдер не вызывает — модель возвращает
 * только намерение, а инструменты зовёт runner через реестр.
 *
 * Молча деградировать в rules нельзя (🔶15 в спеке): любая неудача — нет ключа,
 * сеть, таймаут, мусор в ответе — превращается в `refuse` с причиной, которую
 * увидит человек. Ключ читается из окружения и никуда не пишется, в том числе в лог.
 */

/** Сколько ждём ответа модели. Дольше — покупатель уже ушёл со страницы. */
export const LLM_TIMEOUT_MS = 15_000;

const REQUIRED_ENV = ["LLM_BASE_URL", "LLM_MODEL", "LLM_API_KEY"] as const;

type HttpConfig = { url: string; model: string; apiKey: string };

/** Срез окружения, который читает провайдер; в тестах подставляется объектом. */
type LlmEnv = { [K in (typeof REQUIRED_ENV)[number]]?: string | undefined } & Record<string, string | undefined>;

/** Форма ответа gateway: нужен только текст первого варианта. */
const completionSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string().nullable() }) }))
    .min(1),
});

const RULES_HINT = "Поставьте LLM_PROVIDER=rules — встроенный подбор работает без сети.";

const refuse = (message: string, hint = RULES_HINT): AgentPlan => ({ kind: "refuse", message, hint });

/** Адрес может быть задан как база API или как полный путь до chat/completions. */
function completionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/chat/completions`;
}

/** Модели иногда заворачивают JSON в ```json … ``` вопреки инструкции. */
function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

/**
 * Системный промпт собирается при каждом вызове: список инструментов берётся из
 * реестра, чтобы описание в промпте не расходилось с тем, что есть на самом деле.
 */
export function systemPrompt(): string {
  const tools = allTools()
    .map((tool) => `- ${tool.name} — ${tool.description}\n  параметры: ${JSON.stringify(z.toJSONSchema(tool.parameters))}`)
    .join("\n");

  return [
    "Ты — помощник по подбору растений онлайн-питомника «Северный сад».",
    "Твоя единственная задача: прочитать запрос покупателя об участке и вернуть ТОЛЬКО JSON",
    "по схеме AgentPlan — без текста до и после, без markdown, без пояснений.",
    "",
    "Инструменты ты НЕ вызываешь: их вызовет программа по твоему плану. Список — чтобы ты понимал,",
    "какие условия она умеет применить:",
    tools,
    "",
    "Схема AgentPlan — ровно один из трёх объектов:",
    '1. {"kind":"pick","filters":{...},"reading":[...],"unsupported":[...]}',
    "   filters — параметры для catalog.search_plants, только известные поля:",
    '   light: "sun" | "partial" | "shade"; zone: целое 2…6; season: "spring" | "autumn" | "spring_autumn";',
    '   care: "low" | "medium" | "high". Поле опускай, если в запросе о нём ничего нет.',
    "   Регион переводи в зону: Сибирь, Заполярье — 2; Урал, север, Карелия — 3; Подмосковье,",
    "   средняя полоса, Петербург — 4; чернозёмная полоса — 5; юг, Краснодар, Крым — 6.",
    "   «некогда ухаживать», «неприхотливое», «без хлопот» — care: \"low\".",
    "   reading — короткие фразы по-русски, как ты понял каждое условие (например «света мало — полутень»,",
    "   «зона 4 — средняя полоса», «уход — легко»). Показываются покупателю дословно.",
    "   unsupported — что услышал, но фильтром сделать нельзя: почва (глина, песок, кислая), длительность",
    "   цветения, живая изгородь. Каждая запись — одна фраза по-русски с подсказкой смотреть карточку растения.",
    '2. {"kind":"checkout","method":"pickup"} — только на прямую команду вида «оформляй самовывозом».',
    "   Заказ ты не создаёшь, программа покажет сводку и попросит подтверждения кнопкой.",
    '3. {"kind":"refuse","message":"...","hint":"..."} — короткий отказ по-русски и куда обратиться:',
    "   болезни, вредители, «желтеет», «сохнет» → message: ты не ставишь диагнозы; hint: раздел вопросов агроному, приложить фото;",
    "   доставка, курьер, сроки привоза → hint: способ получения и слоты выбираются на экране оформления заказа;",
    "   оплата, возврат, скидки, чек → hint: статус и состав видны на странице заказа, писать в питомник;",
    "   вообще не про растения и участок → короткий отказ и просьба описать участок: свет, зона или регион, уход.",
    "",
    "Не выдумывай растения и не советуй сорта — только план. Не добавляй полей, которых нет в схеме.",
  ].join("\n");
}

export class HttpProvider implements LlmProvider {
  readonly name = "http";

  private readonly config: HttpConfig | null;
  /** Чего не хватает в окружении. Считается при создании, а не на первом запросе. */
  readonly missingEnv: string[];

  constructor(env: LlmEnv = process.env) {
    this.missingEnv = REQUIRED_ENV.filter((name) => !env[name]?.trim());
    this.config =
      this.missingEnv.length === 0
        ? {
            url: completionsUrl(env.LLM_BASE_URL!.trim()),
            model: env.LLM_MODEL!.trim(),
            apiKey: env.LLM_API_KEY!.trim(),
          }
        : null;
  }

  // Параметр с умолчанием: интерфейс требует строку, но провайдер обязан
  // отвечать отказом и на пустой вызов — без конфигурации до запроса дело не доходит.
  async plan(request = ""): Promise<AgentPlan> {
    if (!this.config) {
      return refuse(
        `Подбор через внешнюю модель не настроен: LLM_PROVIDER=http, но не задано ${this.missingEnv.join(", ")}.`,
        "Задайте переменные в окружении или поставьте LLM_PROVIDER=rules — встроенный подбор работает без сети.",
      );
    }
    if (request.trim().length === 0) {
      return refuse("Пустой запрос — подбирать нечего.", "Опишите участок: свет, зона или регион, уход.");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(this.config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt() },
            { role: "user", content: request },
          ],
        }),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timer);
      if (controller.signal.aborted) {
        return refuse(`Модель не ответила за ${LLM_TIMEOUT_MS / 1000} с — подбор не выполнен.`);
      }
      console.error("http-провайдер: сеть", error instanceof Error ? error.message : error);
      return refuse("Не удалось связаться с внешней моделью — подбор не выполнен.");
    }
    clearTimeout(timer);

    if (!response.ok) {
      // Тело ответа в лог не пишем: gateway может вернуть в нём echo запроса с заголовками.
      console.error("http-провайдер: gateway ответил", response.status);
      return refuse(`Внешняя модель ответила ошибкой ${response.status} — подбор не выполнен.`);
    }

    let text: string | null;
    try {
      const body = completionSchema.safeParse(await response.json());
      if (!body.success) return refuse("Ответ модели пришёл в неожиданном формате — подбор не выполнен.");
      text = body.data.choices[0].message.content;
    } catch {
      return refuse("Ответ модели не удалось прочитать — подбор не выполнен.");
    }

    let raw: unknown;
    try {
      raw = JSON.parse(stripFences(text ?? ""));
    } catch {
      return refuse("Модель вернула не JSON, а текст — план не разобран, подбор не выполнен.");
    }

    const parsed = agentPlanSchema.safeParse(raw);
    if (!parsed.success) {
      const path = parsed.error.issues[0]?.path.join(".") || "kind";
      return refuse(`Модель вернула план не по схеме (поле «${path}») — подбор не выполнен.`);
    }
    return parsed.data;
  }
}
