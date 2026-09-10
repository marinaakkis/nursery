import { z } from "zod";
import type { Tool } from "@/agent/types";
import { calendarRangeSchema, careEventSchema, listCareEvents, listGarden, markCareDone } from "./service";

export const tools: Tool[] = [
  {
    name: "garden.get_garden",
    description:
      "Показать растения в саду покупателя: что куплено, сколько штук и какое действие по уходу ближайшее.",
    parameters: z.object({}),
    audience: "buyer",
    // Инструмент зовёт ту же функцию, что и интерфейс, и работает с тем же
    // покупателем из контекста: чужой сад агенту недоступен.
    handler: async (_args, ctx) => listGarden(ctx.userId),
  },
  {
    name: "garden.get_care_calendar",
    description:
      "Показать календарь ухода покупателя за период: что и когда нужно сделать, что просрочено.",
    parameters: calendarRangeSchema,
    audience: "buyer",
    handler: async (args, ctx) => listCareEvents(args, ctx.userId),
  },
  {
    name: "garden.mark_care_done",
    description:
      "Отметить действие по уходу выполненным. Повторная отметка ничего не меняет; следующее событие считается от фактической даты.",
    parameters: careEventSchema,
    audience: "buyer",
    handler: async (args, ctx) => markCareDone(args, ctx.userId),
  },
];
