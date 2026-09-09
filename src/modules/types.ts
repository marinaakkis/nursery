import type { Result } from "@/lib/result";
import type { Tool } from "@/agent/types";

export type UserRole = "customer" | "agronomist" | "warehouse";

export type RequestContext = { userId: number; role: UserRole };

export type RouteHandler = (
  input: { query: URLSearchParams; body: unknown },
  ctx: RequestContext,
) => Promise<Result<unknown>>;

/** Роут модуля. roles пуст — действие доступно всем ролям. */
export type ModuleRoute = {
  method: "GET" | "POST";
  action: string;
  roles?: UserRole[];
  handler: RouteHandler;
};

/** Контракт модуля: схема экспортируется отдельно, здесь — исполняемая часть. */
export type AppModule = {
  name: string;
  routes: ModuleRoute[];
  tools: Tool[];
};
