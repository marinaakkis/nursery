import type { ModuleRoute } from "@/modules/types";
import { getStock } from "./service";

export const routes: ModuleRoute[] = [
  {
    method: "GET",
    action: "stock",
    // Наличие видно всем: покупателю оно нужно в карточке.
    handler: async ({ query }) => getStock(Object.fromEntries(query.entries())),
  },
];
