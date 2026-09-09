import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db/client";
import { users } from "@/db/shared-schema";
import { DEMO_USER_COOKIE, type DemoUser } from "./demo-user";

/** Заглушка входа, серверная половина. Настоящей аутентификации в продукте нет:
 *  текущий пользователь берётся из cookie, которую ставит переключатель в шапке —
 *  spec §1 и «вне скоупа». Это точка расширения под корпоративный вход,
 *  а не бизнес-логика модуля, поэтому она живёт в lib, а не в service.ts. */
export async function listDemoUsers(): Promise<DemoUser[]> {
  return getDb().select().from(users).orderBy(users.id);
}

export async function currentUser(): Promise<DemoUser | null> {
  const raw = (await cookies()).get(DEMO_USER_COOKIE)?.value;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;

  const [user] = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}
