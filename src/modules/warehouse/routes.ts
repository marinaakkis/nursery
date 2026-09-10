import type { ModuleRoute } from "@/modules/types";
import { getStock, getStockMany, listBatches, purchasePlan, receiveBatch, writeOff } from "./service";

export const routes: ModuleRoute[] = [
  {
    method: "GET",
    action: "stock",
    // Наличие видно всем: покупателю оно нужно в карточке.
    handler: async ({ query }) => getStock(Object.fromEntries(query.entries())),
  },
  {
    method: "GET",
    action: "stocks",
    // Остатки списком: ?plantIds=1,2,3 — один запрос на всю выдачу каталога.
    handler: async ({ query }) => getStockMany(Object.fromEntries(query.entries())),
  },
  {
    method: "GET",
    action: "batches",
    roles: ["warehouse"],
    handler: async ({ query }) => listBatches(Object.fromEntries(query.entries())),
  },
  {
    method: "POST",
    action: "receive",
    roles: ["warehouse"],
    handler: async ({ body }) => receiveBatch(body),
  },
  {
    method: "POST",
    action: "write-off",
    roles: ["warehouse"],
    handler: async ({ body }, ctx) => writeOff(body, ctx.userId),
  },
  {
    method: "GET",
    action: "plan",
    roles: ["warehouse"],
    handler: async () => purchasePlan(),
  },
];
