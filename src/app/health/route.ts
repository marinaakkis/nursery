import { getSql } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getSql()`select 1`;
    return Response.json({ ok: true, db: "up" });
  } catch (error) {
    return Response.json(
      { ok: false, db: "down", error: error instanceof Error ? error.message : "unknown" },
      { status: 503 },
    );
  }
}
