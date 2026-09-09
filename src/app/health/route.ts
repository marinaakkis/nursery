import { getSql } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getSql()`select 1`;
    return Response.json({ ok: true, db: "up" });
  } catch (error) {
    // Наружу причина не уходит: текст ошибки драйвера содержит адрес и порт базы.
    // Диагностика остаётся в логах контейнера.
    console.error("health: база недоступна", error);
    return Response.json({ ok: false, db: "down" }, { status: 503 });
  }
}
