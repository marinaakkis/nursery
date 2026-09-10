import type { Tool } from "@/agent/types";
import { draftAnswer, getQuestion, questionIdSchema } from "./service";

export const tools: Tool[] = [
  {
    name: "consult.get_question",
    description: "Прочитать вопрос покупателя целиком: переписку, растение и приложенные фото.",
    parameters: questionIdSchema,
    audience: "agronomist",
    handler: async (args, ctx) => getQuestion(args, ctx),
  },
  {
    name: "consult.suggest_diagnosis",
    description:
      "Разобрать жалобу на растение и подготовить черновик ответа: вероятная причина, план из двух-трёх шагов и что уточнить у покупателя. Черновик виден только агроному.",
    parameters: questionIdSchema,
    audience: "agronomist",
    // Тот же вызов, что делает интерфейс агронома: своей логики у агента нет.
    handler: async (args, ctx) => draftAnswer(args, ctx),
  },
];
