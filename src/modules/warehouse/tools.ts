import type { Tool } from "@/agent/types";
import { getStock, plantStockSchema } from "./service";

export const tools: Tool[] = [
  {
    name: "warehouse.get_stock",
    description: "Узнать наличие растения: сколько доступно и мало ли осталось.",
    parameters: plantStockSchema,
    audience: "buyer",
    handler: async (args) => getStock(args),
  },
];
