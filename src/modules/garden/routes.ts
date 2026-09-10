import type { ModuleRoute } from "@/modules/types";
import {
  getGardenPlant,
  listCareEvents,
  listGarden,
  markCareDone,
  unmarkCareDone,
} from "./service";

/** Сад у каждого свой: покупатель всегда работает со своим userId из контекста,
 *  чужой идентификатор передать нечем. */
export const routes: ModuleRoute[] = [
  {
    method: "GET",
    action: "plants",
    roles: ["customer"],
    handler: async (_input, ctx) => listGarden(ctx.userId),
  },
  {
    method: "GET",
    action: "plant",
    roles: ["customer"],
    handler: async ({ query }, ctx) => getGardenPlant(Object.fromEntries(query.entries()), ctx.userId),
  },
  {
    method: "GET",
    action: "calendar",
    roles: ["customer"],
    handler: async ({ query }, ctx) => listCareEvents(Object.fromEntries(query.entries()), ctx.userId),
  },
  {
    method: "POST",
    action: "care-done",
    roles: ["customer"],
    handler: async ({ body }, ctx) => markCareDone(body, ctx.userId),
  },
  {
    method: "POST",
    action: "care-undone",
    roles: ["customer"],
    handler: async ({ body }, ctx) => unmarkCareDone(body, ctx.userId),
  },
];
