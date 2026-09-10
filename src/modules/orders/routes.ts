import type { ModuleRoute } from "@/modules/types";
import {
  addToCart,
  createOrder,
  getCart,
  getOrder,
  listOrders,
  listSlots,
  removeFromCart,
  setQty,
  listOrdersForAssembly,
  transition,
} from "./service";

/** Все действия с корзиной и заказом — от лица покупателя из cookie demo_user_id.
 *  Переход статуса доступен и складу: покупателю сервис разрешает только отмену. */
export const routes: ModuleRoute[] = [
  {
    method: "GET",
    action: "cart",
    roles: ["customer"],
    handler: async (_input, ctx) => getCart(ctx.userId),
  },
  {
    method: "POST",
    action: "cart-item",
    roles: ["customer"],
    handler: async ({ body }, ctx) => addToCart(body, ctx.userId),
  },
  {
    method: "POST",
    action: "cart-qty",
    roles: ["customer"],
    handler: async ({ body }, ctx) => setQty(body, ctx.userId),
  },
  {
    method: "POST",
    action: "cart-remove",
    roles: ["customer"],
    handler: async ({ body }, ctx) => removeFromCart(body, ctx.userId),
  },
  {
    method: "GET",
    action: "slots",
    roles: ["customer"],
    handler: async () => listSlots(),
  },
  {
    method: "POST",
    action: "create",
    roles: ["customer"],
    handler: async ({ body }, ctx) => createOrder(body, ctx.userId),
  },
  {
    method: "GET",
    action: "order",
    roles: ["customer"],
    handler: async ({ query }, ctx) => getOrder(Object.fromEntries(query.entries()), ctx.userId),
  },
  {
    method: "GET",
    action: "list",
    roles: ["customer"],
    handler: async (_input, ctx) => listOrders(ctx.userId),
  },
  {
    method: "POST",
    action: "transition",
    roles: ["customer", "warehouse"],
    handler: async ({ body }, ctx) => transition(body, ctx),
  },
  {
    method: "GET",
    action: "assembly",
    // Очередь сборки: список заказов для склада, поэтому живёт в orders.
    roles: ["warehouse"],
    handler: async () => listOrdersForAssembly(),
  },
];
