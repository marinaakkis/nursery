import { z } from "zod";
import type { Tool } from "@/agent/types";
import {
  addToCart,
  cartItemSchema,
  createOrderSchema,
  createOrder,
  getCart,
  getOrder,
  listOrders,
  listSlots,
  orderRefSchema,
} from "./service";

const empty = z.object({});

/** Агент покупателя доводит до корзины и оформляет заказ только по явной команде.
 *  Своей логики поверх данных здесь нет — те же функции, что зовёт интерфейс. */
export const tools: Tool[] = [
  {
    name: "orders.get_cart",
    description: "Показать состав корзины покупателя и итоговую сумму.",
    parameters: empty,
    audience: "buyer",
    handler: async (_args, ctx) => getCart(ctx.userId),
  },
  {
    name: "orders.add_to_cart",
    description: "Положить растение в корзину покупателя в указанном количестве.",
    parameters: cartItemSchema,
    audience: "buyer",
    handler: async (args, ctx) => addToCart(args, ctx.userId),
  },
  {
    name: "orders.list_slots",
    description: "Показать свободные слоты доставки на ближайшие дни.",
    parameters: empty,
    audience: "buyer",
    handler: async () => listSlots(),
  },
  {
    name: "orders.create_order",
    description:
      "Оформить заказ из корзины: самовывоз или доставка в выбранный слот. Необратимо — вызывать только после явного подтверждения покупателя.",
    parameters: createOrderSchema,
    audience: "buyer",
    handler: async (args, ctx) => createOrder(args, ctx.userId),
  },
  {
    name: "orders.get_order",
    description: "Показать заказ покупателя: состав, статус и историю переходов.",
    parameters: orderRefSchema,
    audience: "buyer",
    handler: async (args, ctx) => getOrder(args, ctx.userId),
  },
  {
    name: "orders.list_orders",
    description: "Показать список заказов покупателя.",
    parameters: empty,
    audience: "buyer",
    handler: async (_args, ctx) => listOrders(ctx.userId),
  },
];
