import type { Tool } from "@/agent/types";
import { getStock, getStockMany, plantsStockSchema, plantStockSchema } from "./service";

export const tools: Tool[] = [
  {
    name: "warehouse.get_stock",
    description: "Узнать наличие растения: сколько доступно и мало ли осталось.",
    parameters: plantStockSchema,
    audience: "buyer",
    handler: async (args) => getStock(args),
  },
  {
    name: "warehouse.get_stock_many",
    description:
      "Узнать наличие сразу нескольких растений одним запросом: для списка идентификаторов вернёт доступное количество по каждому.",
    parameters: plantsStockSchema,
    audience: "buyer",
    handler: async (args) => getStockMany(args),
  },
];
