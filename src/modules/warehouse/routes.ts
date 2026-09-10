import type { ModuleRoute } from "@/modules/types";
import { getStock, getStockMany } from "./service";

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
];
