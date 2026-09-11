import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpProvider, LLM_TIMEOUT_MS, systemPrompt } from "./http-provider";
import { allTools } from "./registry";

/**
 * Провайдер тестируется без сети: fetch замокан. Проверяется контракт
 * «текст → AgentPlan» и главное — что любая неудача становится отказом
 * с причиной, а не тихим откатом на rules (🔶15).
 */

const ENV = {
  LLM_BASE_URL: "https://gateway.example.com/api/v2",
  LLM_MODEL: "gpt-4o",
  LLM_API_KEY: "test-key-not-real",
};

/** Ответ gateway в формате chat completions с заданным текстом. */
const completion = (content: string, status = 200) =>
  new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content } }] }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("http-провайдер: конфигурация", () => {
  it("без LLM_API_KEY отказывает сразу при создании, не трогая сеть", async () => {
    const provider = new HttpProvider({ ...ENV, LLM_API_KEY: "" });
    expect(provider.missingEnv).toEqual(["LLM_API_KEY"]);

    const plan = await provider.plan("тень, зона 4");
    expect(plan.kind).toBe("refuse");
    if (plan.kind !== "refuse") return;
    expect(plan.message).toContain("LLM_API_KEY");
    expect(plan.hint).toContain("rules");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("перечисляет все недостающие переменные, а не первую попавшуюся", () => {
    expect(new HttpProvider({}).missingEnv).toEqual(["LLM_BASE_URL", "LLM_MODEL", "LLM_API_KEY"]);
  });

  it("ключ уходит только в заголовок Authorization, адрес дополняется до chat/completions", async () => {
    fetchMock.mockResolvedValue(completion('{"kind":"checkout","method":"pickup"}'));
    await new HttpProvider(ENV).plan("оформляй самовывозом");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://gateway.example.com/api/v2/chat/completions");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key-not-real");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe("gpt-4o");
    expect(body.messages[1]).toEqual({ role: "user", content: "оформляй самовывозом" });
    expect(String(init?.body)).not.toContain("test-key-not-real");
  });

  it("полный адрес до chat/completions не дублируется", async () => {
    fetchMock.mockResolvedValue(completion('{"kind":"checkout","method":"pickup"}'));
    await new HttpProvider({ ...ENV, LLM_BASE_URL: `${ENV.LLM_BASE_URL}/chat/completions/` }).plan("оформляй самовывозом");
    expect(fetchMock.mock.calls[0][0]).toBe("https://gateway.example.com/api/v2/chat/completions");
  });
});

describe("http-провайдер: системный промпт", () => {
  it("описывает каждый инструмент реестра и требует только JSON", () => {
    const prompt = systemPrompt();
    for (const tool of allTools()) expect(prompt).toContain(tool.name);
    expect(prompt).toContain("ТОЛЬКО JSON");
    expect(prompt).toContain("Северный сад");
  });
});

describe("http-провайдер: разбор ответа", () => {
  it("валидный JSON → pick с теми же фильтрами", async () => {
    fetchMock.mockResolvedValue(
      completion(
        JSON.stringify({
          kind: "pick",
          filters: { light: "partial", zone: 4, care: "low" },
          reading: ["света мало — полутень", "зона 4 — средняя полоса", "уход — легко"],
          unsupported: ["про глинистую почву — фильтра по почве нет"],
        }),
      ),
    );
    const plan = await new HttpProvider(ENV).plan("участок в полутени, Подмосковье, некогда ухаживать, глина");
    expect(plan.kind).toBe("pick");
    if (plan.kind !== "pick") return;
    expect(plan.filters).toEqual({ light: "partial", zone: 4, care: "low" });
    expect(plan.reading).toHaveLength(3);
    expect(plan.unsupported).toHaveLength(1);
  });

  it("JSON в ограде ```json тоже разбирается", async () => {
    fetchMock.mockResolvedValue(
      completion('```json\n{"kind":"pick","filters":{"light":"shade"},"reading":["тень"],"unsupported":[]}\n```'),
    );
    const plan = await new HttpProvider(ENV).plan("тень");
    expect(plan.kind).toBe("pick");
  });

  it("мусор вместо JSON → refuse с причиной, не откат на rules", async () => {
    fetchMock.mockResolvedValue(completion("Конечно! Для тенистого участка подойдут хосты и папоротники."));
    const plan = await new HttpProvider(ENV).plan("тень");
    expect(plan.kind).toBe("refuse");
    if (plan.kind !== "refuse") return;
    expect(plan.message).toContain("не JSON");
  });

  it("намерение вызвать инструмент {tool: orders.create_order} не проходит схему → refuse", async () => {
    fetchMock.mockResolvedValue(completion('{"tool":"orders.create_order","args":{"method":"pickup"}}'));
    const plan = await new HttpProvider(ENV).plan("оформляй самовывозом");
    expect(plan.kind).toBe("refuse");
    if (plan.kind !== "refuse") return;
    expect(plan.message).toContain("не по схеме");
  });

  it("pick с неизвестным значением фильтра не проходит схему → refuse", async () => {
    fetchMock.mockResolvedValue(
      completion('{"kind":"pick","filters":{"light":"dark","soil":"clay"},"reading":[],"unsupported":[]}'),
    );
    const plan = await new HttpProvider(ENV).plan("темно");
    expect(plan.kind).toBe("refuse");
    if (plan.kind !== "refuse") return;
    expect(plan.message).toContain("light");
  });

  it("gateway ответил не 2xx → refuse с кодом", async () => {
    fetchMock.mockResolvedValue(completion("", 502));
    const plan = await new HttpProvider(ENV).plan("тень");
    expect(plan.kind).toBe("refuse");
    if (plan.kind !== "refuse") return;
    expect(plan.message).toContain("502");
  });

  it("ответ без choices → refuse", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "quota" }), { status: 200 }));
    const plan = await new HttpProvider(ENV).plan("тень");
    expect(plan.kind).toBe("refuse");
  });

  it("сеть недоступна → refuse", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const plan = await new HttpProvider(ENV).plan("тень");
    expect(plan.kind).toBe("refuse");
    if (plan.kind !== "refuse") return;
    expect(plan.message).toContain("связаться");
  });

  it("таймаут 15 с → refuse, запрос прерывается сигналом", async () => {
    vi.useFakeTimers();
    // Мок «висит», пока провайдер не дёрнет abort — как настоящий fetch.
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("This operation was aborted", "AbortError")),
          );
        }),
    );

    const pending = new HttpProvider(ENV).plan("тень");
    await vi.advanceTimersByTimeAsync(LLM_TIMEOUT_MS - 1);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    const plan = await pending;
    expect(plan.kind).toBe("refuse");
    if (plan.kind !== "refuse") return;
    expect(plan.message).toContain("15 с");
  });
});
