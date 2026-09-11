import { getSql } from "@/db/client";

export const dynamic = "force-dynamic";

/** Код Postgres «таблицы нет»: undefined_table. */
const UNDEFINED_TABLE = "42P01";

/**
 * Живость — это не только соединение. База может отвечать на select 1
 * и при этом не иметь ни одной таблицы: так было 11.09, когда схему снесли
 * вручную, а контейнер приложения не перезапустили. Health был зелёным,
 * страницы отдавали 200, а каждый запрос к данным падал с 42P01.
 * Разбор — memory/mistakes/2026-09-11-shema-snesena-kontejner-ne-perezapushchen.md
 *
 * Поэтому проверяется ключевая таблица: нет plants — нет и продукта.
 */
export async function GET() {
  try {
    await getSql()`select 1 from plants limit 1`;
    return Response.json({ ok: true, db: "up" });
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;

    if (code === UNDEFINED_TABLE) {
      // Соединение есть, схемы нет: миграции не отработали.
      console.error("health: база отвечает, но схемы нет — миграции не применялись", error);
      return Response.json({ ok: false, db: "no-schema" }, { status: 503 });
    }

    // Наружу причина не уходит: текст ошибки драйвера содержит адрес и порт базы.
    console.error("health: база недоступна", error);
    return Response.json({ ok: false, db: "down" }, { status: 503 });
  }
}
