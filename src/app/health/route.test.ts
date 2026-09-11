import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Health обязан краснеть на пустой схеме, а не только на мёртвом соединении.
 * Драйвер подменяется: нужен ответ базы «таблицы нет», а не сама база.
 */
const sqlMock = vi.fn();

vi.mock("@/db/client", () => ({
  getSql: () => sqlMock,
}));

afterEach(() => {
  sqlMock.mockReset();
});

describe("/health", () => {
  it("зелёный, когда ключевая таблица отвечает", async () => {
    sqlMock.mockResolvedValue([]);
    const { GET } = await import("./route");

    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, db: "up" });
  });

  it("спрашивает именно ключевую таблицу, а не select 1", async () => {
    // Мок бросит 42P01 на любой запрос — поэтому текст запроса проверяется
    // отдельно: иначе откат к select 1 остался бы зелёным.
    sqlMock.mockResolvedValue([]);
    const { GET } = await import("./route");
    await GET();

    const strings = sqlMock.mock.calls[0]?.[0] as readonly string[] | undefined;
    expect(strings?.join("")).toMatch(/from\s+plants/);
  });

  it("красный с db: no-schema, когда таблицы нет (42P01)", async () => {
    const undefinedTable = Object.assign(new Error('relation "plants" does not exist'), {
      code: "42P01",
    });
    sqlMock.mockRejectedValue(undefinedTable);
    const { GET } = await import("./route");

    const response = await GET();
    expect(response.status).not.toBe(200);
    expect(await response.json()).toEqual({ ok: false, db: "no-schema" });
  });

  it("красный с db: down, когда соединения нет", async () => {
    sqlMock.mockRejectedValue(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }));
    const { GET } = await import("./route");

    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, db: "down" });
  });

  it("причина отказа наружу не уходит — в теле нет адреса базы", async () => {
    sqlMock.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:5432"));
    const { GET } = await import("./route");

    const body = JSON.stringify(await (await GET()).json());
    expect(body).not.toContain("10.0.0.5");
    expect(body).not.toContain("ECONNREFUSED");
  });
});
