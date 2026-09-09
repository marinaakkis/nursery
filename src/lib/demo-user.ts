/** Общая часть заглушки входа: её импортирует и сервер, и клиент.
 *  Серверных импортов здесь быть не должно — они утянут в браузерный бандл
 *  весь модуль. Чтение cookie и запросы к базе — в demo-user.server.ts. */

export const DEMO_USER_COOKIE = "demo_user_id";

export type DemoRole = "customer" | "agronomist" | "warehouse";

export type DemoUser = { id: number; name: string; role: DemoRole };

export const ROLE_LABEL: Record<DemoRole, string> = {
  customer: "покупатель",
  agronomist: "агроном",
  warehouse: "склад",
};
