import type { ModuleRoute } from "@/modules/types";
import {
  addMessage,
  approveDraft,
  createQuestion,
  draftAnswer,
  getQuestion,
  listMyGardenPlants,
  listQuestions,
  rejectDraft,
} from "./service";

export const routes: ModuleRoute[] = [
  {
    method: "GET",
    action: "questions",
    // Покупатель видит свои, агроном — все. Разделение внутри сервиса.
    roles: ["customer", "agronomist"],
    handler: async (_input, ctx) => listQuestions(ctx),
  },
  {
    method: "GET",
    action: "question",
    roles: ["customer", "agronomist"],
    handler: async ({ query }, ctx) => getQuestion(Object.fromEntries(query.entries()), ctx),
  },
  {
    method: "GET",
    action: "my-plants",
    roles: ["customer"],
    handler: async (_input, ctx) => listMyGardenPlants(ctx.userId),
  },
  {
    method: "POST",
    action: "ask",
    roles: ["customer"],
    handler: async ({ body }, ctx) => createQuestion(body, ctx.userId),
  },
  {
    method: "POST",
    action: "message",
    roles: ["customer", "agronomist"],
    handler: async ({ body }, ctx) => addMessage(body, ctx),
  },
  {
    method: "POST",
    action: "draft",
    roles: ["agronomist"],
    handler: async ({ body }, ctx) => draftAnswer(body, ctx),
  },
  {
    method: "POST",
    action: "approve",
    roles: ["agronomist"],
    handler: async ({ body }, ctx) => approveDraft(body, ctx),
  },
  {
    method: "POST",
    action: "reject",
    roles: ["agronomist"],
    handler: async ({ body }, ctx) => rejectDraft(body, ctx),
  },
];
