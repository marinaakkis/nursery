import type { ModuleRoute } from "@/modules/types";
import { getPlant, searchPlants } from "./service";

export const routes: ModuleRoute[] = [
  {
    method: "GET",
    action: "plants",
    // Каталог виден всем ролям — ограничения по ролям нет.
    handler: async ({ query }) => searchPlants(Object.fromEntries(query.entries())),
  },
  {
    method: "GET",
    action: "plant",
    handler: async ({ query }) => getPlant(Object.fromEntries(query.entries())),
  },
];
