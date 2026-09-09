import type { Tool } from "@/agent/types";
import { plantFiltersSchema, searchPlants } from "./service";

export const tools: Tool[] = [
  {
    name: "catalog.search_plants",
    description:
      "Найти растения по условиям участка: свет, зона морозостойкости, сезон посадки, уровень ухода.",
    parameters: plantFiltersSchema,
    audience: "buyer",
    // Инструмент зовёт ту же функцию, что и интерфейс: своей логики у агента нет.
    handler: async (args) => searchPlants(args),
  },
];
