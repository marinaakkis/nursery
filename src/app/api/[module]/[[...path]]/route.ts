import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { getModule } from "@/agent/registry";
import { HTTP_STATUS, type Result } from "@/lib/result";
import { users } from "@/db/shared-schema";
import type { RequestContext, ModuleRoute } from "@/modules/types";

export const dynamic = "force-dynamic";

type Params = { module: string; path?: string[] };

function respond(result: Result<unknown>): Response {
  if (result.ok) return Response.json({ ok: true, data: result.data });
  const status = HTTP_STATUS[result.error.code] ?? 400;
  return Response.json({ ok: false, error: result.error }, { status });
}

function errorResponse(code: string, message: string): Response {
  return Response.json(
    { ok: false, error: { code, message } },
    { status: HTTP_STATUS[code] ?? 400 },
  );
}

/** Текущий пользователь — из cookie demo_user_id, которую ставит переключатель пользователя.
 *  Настоящей аутентификации нет: это заглушка и точка расширения под корпоративный вход. */
async function resolveContext(request: Request): Promise<RequestContext | null> {
  const raw = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("demo_user_id="))
    ?.slice("demo_user_id=".length);

  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;

  const [user] = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  return user ? { userId: user.id, role: user.role } : null;
}

async function dispatch(request: Request, params: Promise<Params>): Promise<Response> {
  const { module: moduleName, path } = await params;
  const appModule = getModule(moduleName);
  if (!appModule) return errorResponse("not_found", "Неизвестный модуль");

  const action = (path ?? []).join("/");
  const route: ModuleRoute | undefined = appModule.routes.find(
    (r) => r.action === action && r.method === request.method,
  );
  if (!route) return errorResponse("not_found", "Неизвестное действие модуля");

  let ctx: RequestContext | null = null;
  try {
    ctx = await resolveContext(request);
  } catch {
    return errorResponse("internal", "Не удалось определить пользователя");
  }

  // Роль проверяет сам роут модуля — диспетчер только доставляет контекст.
  if (route.roles?.length) {
    if (!ctx) return errorResponse("forbidden", "Выберите пользователя в шапке");
    if (!route.roles.includes(ctx.role)) {
      return errorResponse("forbidden", "Действие недоступно для этой роли");
    }
  }

  const url = new URL(request.url);
  const body = request.method === "POST" ? await request.json().catch(() => null) : null;

  try {
    const result = await route.handler(
      { query: url.searchParams, body },
      ctx ?? { userId: 0, role: "customer" },
    );
    return respond(result);
  } catch (error) {
    console.error("route failed", moduleName, action, error);
    return errorResponse("internal", "Внутренняя ошибка");
  }
}

export async function GET(request: Request, { params }: { params: Promise<Params> }) {
  return dispatch(request, params);
}

export async function POST(request: Request, { params }: { params: Promise<Params> }) {
  return dispatch(request, params);
}
