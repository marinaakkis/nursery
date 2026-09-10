"use server";

import { cookies } from "next/headers";
import { ask, callTool, type AgentAnswer } from "@/agent/runner";
import type { ToolContext } from "@/agent/types";
import { DEMO_USER_COOKIE } from "@/lib/demo-user";
import { currentUser } from "@/lib/demo-user.server";

/**
 * 🔶 Агент вызывается серверными действиями, а не своим HTTP-роутом:
 * по контракту репозитория в src/app/api лежит ровно один каталог [module],
 * а шестого модуля у продукта нет. Инструменты при этом те же самые —
 * действия ходят через реестр, как и всё остальное.
 */

export type AskResult =
  | { ok: true; answer: AgentAnswer }
  | { ok: false; message: string; hint?: string };

type Gate = { error: string } | { ctx: ToolContext };

async function requireCustomer(): Promise<Gate> {
  const user = await currentUser();
  if (!user) return { error: "Выберите покупателя в шапке — агент работает от его лица." };
  if (user.role !== "customer") {
    return { error: "Подбор доступен покупателю. Переключите пользователя в шапке." };
  }
  return { ctx: { userId: user.id, role: user.role } as const };
}

export async function askAgent(request: string): Promise<AskResult> {
  const text = request.trim();
  if (text.length === 0) return { ok: false, message: "Напишите, что нужно подобрать." };
  if (text.length > 500) {
    return { ok: false, message: "Слишком длинно — опишите участок в паре фраз." };
  }

  const gate = await requireCustomer();
  if ("error" in gate) return { ok: false, message: gate.error };

  try {
    return { ok: true, answer: await ask(text, gate.ctx) };
  } catch (error) {
    console.error("агент: подбор не удался", error);
    return { ok: false, message: "Агент не ответил. Попробуйте ещё раз." };
  }
}

export type AddResult =
  | { ok: true; added: number; totalCents: number; step: { args: string; result: string } }
  | { ok: false; message: string };

/**
 * Добавление в корзину. Вызывается только обработчиком кнопки подтверждения:
 * confirmed = true ставится здесь, а не приходит из запроса пользователя.
 */
export async function confirmAddToCart(plantIds: number[]): Promise<AddResult> {
  const gate = await requireCustomer();
  if ("error" in gate) return { ok: false, message: gate.error };
  if (plantIds.length === 0) return { ok: false, message: "Нечего добавлять." };

  let added = 0;
  for (const plantId of plantIds) {
    const result = await callTool("orders.add_to_cart", { plantId, quantity: 1 }, gate.ctx, true);
    if (!result.ok) return { ok: false, message: result.error.message };
    added += 1;
  }

  const cart = await callTool("orders.get_cart", {}, gate.ctx);
  const totalCents = cart.ok ? (cart.data as { totalCents: number }).totalCents : 0;

  return {
    ok: true,
    added,
    totalCents,
    step: {
      args: `${added} шт. по кнопке подтверждения`,
      result: `в корзине на ${Math.round(totalCents / 100)} ₽`,
    },
  };
}

/** Заглушка входа: используется экраном, чтобы не гадать про пользователя. */
export async function selectedUserName(): Promise<string | null> {
  const raw = (await cookies()).get(DEMO_USER_COOKIE)?.value;
  if (!raw) return null;
  const user = await currentUser();
  return user?.name ?? null;
}
