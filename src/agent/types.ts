import type { ZodType } from "zod";
import type { Result } from "@/lib/result";
import type { UserRole } from "@/modules/types";

export type ToolAudience = "buyer" | "agronomist";

export type ToolContext = { userId: number; role: UserRole };

/** Инструмент агента: описание + обработчик, который зовёт функцию из service.ts своего модуля. */
export type Tool = {
  name: string;
  description: string;
  parameters: ZodType;
  audience: ToolAudience;
  handler: (args: unknown, ctx: ToolContext) => Promise<Result<unknown>>;
};
