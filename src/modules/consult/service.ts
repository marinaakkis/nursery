import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { users } from "@/db/shared-schema";
import { fail, ok, type Result } from "@/lib/result";
import { plants } from "@/modules/catalog";
import { gardenPlants } from "@/modules/garden";
import type { UserRole } from "@/modules/types";
import { diagnose, type PlantFacts } from "./diagnosis";
import { savePhoto } from "./photos";
import { answerDrafts, messages, questions } from "./schema";

/**
 * Вопросы агроному и точка human review.
 *
 * Главный инвариант модуля: покупатель видит только сообщения. Черновик
 * агента живёт отдельной таблицей и становится сообщением ровно одним
 * способом — через approveDraft. Другого пути из черновика к покупателю нет.
 */

export const STATUS_LABEL: Record<string, string> = {
  new: "новый",
  in_progress: "в работе",
  answered: "отвечен",
};

const photoField = z.string().min(1).max(3_000_000).optional();

export const newQuestionSchema = z.object({
  text: z.string().trim().min(10, "Опишите проблему хотя бы одним предложением").max(2000),
  plantId: z.coerce.number().int().positive().optional(),
  photo: photoField,
});

export const questionIdSchema = z.object({
  questionId: z.coerce.number().int().positive(),
});

export const newMessageSchema = questionIdSchema.extend({
  text: z.string().trim().min(1).max(2000),
  photo: photoField,
});

export const approveSchema = questionIdSchema.extend({
  /** Агроном может отправить свой текст вместо черновика — это и есть правка. */
  editedText: z.string().trim().min(1).max(4000).optional(),
});

export type QuestionListItem = {
  id: number;
  status: string;
  statusLabel: string;
  createdAt: string;
  customerName: string;
  plantName: string | null;
  preview: string;
  messageCount: number;
  hasPhoto: boolean;
  hasDraft: boolean;
};

export type QuestionMessage = {
  id: number;
  authorName: string;
  authorRole: UserRole;
  body: string;
  photoUrl: string | null;
  createdAt: string;
};

export type DraftView = {
  id: number;
  body: string;
  rationale: string;
  confidence: number;
  createdAt: string;
};

export type QuestionDetail = {
  id: number;
  status: string;
  statusLabel: string;
  createdAt: string;
  customerName: string;
  plantId: number | null;
  plantName: string | null;
  messages: QuestionMessage[];
  /** Приходит только агроному. Покупателю здесь всегда null. */
  draft: DraftView | null;
};

const photoUrlOf = (path: string | null): string | null => (path ? `/uploads/${path}` : null);

// ─────────────────────────────── вопросы ───────────────────────────────

/** Растения из сада покупателя — из них выбирается предмет вопроса. */
export async function listMyGardenPlants(
  customerId: number,
): Promise<Result<{ plantId: number; nameRu: string }[]>> {
  const rows = await getDb()
    .select({ plantId: gardenPlants.plantId, nameRu: plants.nameRu })
    .from(gardenPlants)
    .innerJoin(plants, eq(plants.id, gardenPlants.plantId))
    .where(eq(gardenPlants.customerId, customerId))
    .orderBy(asc(plants.nameRu));
  return ok(rows);
}

export async function createQuestion(
  raw: unknown,
  customerId: number,
): Promise<Result<{ questionId: number; photoSaved: boolean; photoError?: string }>> {
  const parsed = newQuestionSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("validation_failed", parsed.error.issues[0]?.message ?? "Проверьте вопрос", parsed.error.issues);
  }
  const { text, plantId, photo } = parsed.data;

  // Фото сохраняется до транзакции: вопрос дороже снимка и обязан уйти
  // даже тогда, когда файл не записался — spec §3.4, AC12.
  let photoPath: string | null = null;
  let photoError: string | undefined;
  if (photo) {
    const saved = await savePhoto(photo);
    if (saved.ok) photoPath = saved.relativePath;
    else photoError = saved.reason;
  }

  const db = getDb();
  const questionId = await db.transaction(async (tx) => {
    const [question] = await tx.insert(questions).values({ customerId, plantId }).returning();
    await tx.insert(messages).values({
      questionId: question.id,
      authorId: customerId,
      authorRole: "customer",
      body: text,
      photoPath,
    });
    return question.id;
  });

  return ok({ questionId, photoSaved: photoPath !== null, photoError });
}

export async function addMessage(
  raw: unknown,
  actor: { userId: number; role: UserRole },
): Promise<Result<{ messageId: number; photoSaved: boolean; photoError?: string }>> {
  const parsed = newMessageSchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "Проверьте сообщение", parsed.error.issues);
  const { questionId, text, photo } = parsed.data;

  const db = getDb();
  const [question] = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1);
  if (!question) return fail("not_found", "Такого вопроса нет");
  if (actor.role === "customer" && question.customerId !== actor.userId) {
    return fail("forbidden", "Это вопрос другого покупателя");
  }
  if (actor.role === "warehouse") return fail("forbidden", "Переписку ведёт агроном");

  let photoPath: string | null = null;
  let photoError: string | undefined;
  if (photo) {
    const saved = await savePhoto(photo);
    if (saved.ok) photoPath = saved.relativePath;
    else photoError = saved.reason;
  }

  const [created] = await db
    .insert(messages)
    .values({
      questionId,
      authorId: actor.userId,
      authorRole: actor.role,
      body: text,
      photoPath,
    })
    .returning();

  return ok({ messageId: created.id, photoSaved: photoPath !== null, photoError });
}

export async function listQuestions(actor: {
  userId: number;
  role: UserRole;
}): Promise<Result<QuestionListItem[]>> {
  if (actor.role === "warehouse") return fail("forbidden", "Вопросы ведёт агроном");

  const db = getDb();
  const rows = await db
    .select({
      id: questions.id,
      status: questions.status,
      createdAt: questions.createdAt,
      customerName: users.name,
      plantName: plants.nameRu,
    })
    .from(questions)
    .innerJoin(users, eq(users.id, questions.customerId))
    .leftJoin(plants, eq(plants.id, questions.plantId))
    .where(actor.role === "customer" ? eq(questions.customerId, actor.userId) : sql`true`)
    .orderBy(desc(questions.createdAt));

  if (rows.length === 0) return ok([]);

  const ids = rows.map((row) => row.id);
  const allMessages = await db
    .select({
      questionId: messages.questionId,
      body: messages.body,
      photoPath: messages.photoPath,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(sql`${messages.questionId} in ${ids}`)
    .orderBy(asc(messages.createdAt));

  // Черновики считаем только агроному: покупателю их существование не видно.
  const draftIds = new Set<number>();
  if (actor.role === "agronomist") {
    const drafts = await db
      .select({ questionId: answerDrafts.questionId })
      .from(answerDrafts)
      .where(and(sql`${answerDrafts.questionId} in ${ids}`, sql`${answerDrafts.approvedAt} is null`));
    for (const draft of drafts) draftIds.add(draft.questionId);
  }

  return ok(
    rows.map((row) => {
      const own = allMessages.filter((message) => message.questionId === row.id);
      const first = own[0];
      return {
        id: row.id,
        status: row.status,
        statusLabel: STATUS_LABEL[row.status] ?? row.status,
        createdAt: row.createdAt.toISOString(),
        customerName: row.customerName,
        plantName: row.plantName,
        preview: first ? first.body.slice(0, 120) : "",
        messageCount: own.length,
        hasPhoto: own.some((message) => message.photoPath !== null),
        hasDraft: draftIds.has(row.id),
      };
    }),
  );
}

export async function getQuestion(
  raw: unknown,
  actor: { userId: number; role: UserRole },
): Promise<Result<QuestionDetail>> {
  const parsed = questionIdSchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "Неверный вопрос", parsed.error.issues);

  const db = getDb();
  const [row] = await db
    .select({
      id: questions.id,
      status: questions.status,
      createdAt: questions.createdAt,
      customerId: questions.customerId,
      customerName: users.name,
      plantId: questions.plantId,
      plantName: plants.nameRu,
    })
    .from(questions)
    .innerJoin(users, eq(users.id, questions.customerId))
    .leftJoin(plants, eq(plants.id, questions.plantId))
    .where(eq(questions.id, parsed.data.questionId))
    .limit(1);

  if (!row) return fail("not_found", "Такого вопроса нет");
  if (actor.role === "warehouse") return fail("forbidden", "Вопросы ведёт агроном");
  if (actor.role === "customer" && row.customerId !== actor.userId) {
    return fail("forbidden", "Это вопрос другого покупателя");
  }

  const thread = await db
    .select({
      id: messages.id,
      authorName: users.name,
      authorRole: messages.authorRole,
      body: messages.body,
      photoPath: messages.photoPath,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.authorId))
    .where(eq(messages.questionId, row.id))
    .orderBy(asc(messages.createdAt));

  // Черновик отдаётся только агроному. Для покупателя его здесь не существует.
  let draft: DraftView | null = null;
  if (actor.role === "agronomist") {
    const [found] = await db
      .select()
      .from(answerDrafts)
      .where(and(eq(answerDrafts.questionId, row.id), sql`${answerDrafts.approvedAt} is null`))
      .orderBy(desc(answerDrafts.createdAt))
      .limit(1);
    if (found) {
      draft = {
        id: found.id,
        body: found.body,
        rationale: found.rationale,
        confidence: found.confidence,
        createdAt: found.createdAt.toISOString(),
      };
    }
  }

  return ok({
    id: row.id,
    status: row.status,
    statusLabel: STATUS_LABEL[row.status] ?? row.status,
    createdAt: row.createdAt.toISOString(),
    customerName: row.customerName,
    plantId: row.plantId,
    plantName: row.plantName,
    messages: thread.map((message) => ({
      id: message.id,
      authorName: message.authorName,
      authorRole: message.authorRole,
      body: message.body,
      photoUrl: photoUrlOf(message.photoPath),
      createdAt: message.createdAt.toISOString(),
    })),
    draft,
  });
}

// ─────────────────────── черновик агента и human review ───────────────────────

export type DraftResult = {
  questionId: number;
  draft: DraftView | null;
  /** Что агент разобрал — для карточки «что сделал и почему». */
  steps: { tool: string; title: string; args: string; result: string }[];
  refusal?: { message: string; hint: string };
  askAbout: string[];
};

/**
 * Готовит черновик ответа. Доступно только агроному: агент работает его руками
 * и его глазами. Черновик пишется в answer_drafts и покупателю не виден.
 */
export async function draftAnswer(
  raw: unknown,
  actor: { userId: number; role: UserRole },
): Promise<Result<DraftResult>> {
  if (actor.role !== "agronomist") return fail("forbidden", "Черновики готовит агроном");

  const parsed = questionIdSchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "Неверный вопрос", parsed.error.issues);
  const { questionId } = parsed.data;

  const db = getDb();
  const [question] = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1);
  if (!question) return fail("not_found", "Такого вопроса нет");

  const thread = await db
    .select({ body: messages.body, authorRole: messages.authorRole })
    .from(messages)
    .where(eq(messages.questionId, questionId))
    .orderBy(asc(messages.createdAt));

  const complaint = thread
    .filter((message) => message.authorRole === "customer")
    .map((message) => message.body)
    .join("\n");

  const steps: DraftResult["steps"] = [
    {
      tool: "consult.get_question",
      title: "Прочитал переписку",
      args: `вопрос №${questionId}`,
      result: `сообщений покупателя: ${thread.filter((m) => m.authorRole === "customer").length}`,
    },
  ];

  let facts: PlantFacts | null = null;
  if (question.plantId) {
    const [plant] = await db
      .select({
        nameRu: plants.nameRu,
        light: plants.light,
        minZone: plants.minZone,
        soil: plants.soil,
        careLevel: plants.careLevel,
      })
      .from(plants)
      .where(eq(plants.id, question.plantId))
      .limit(1);
    facts = plant ?? null;
    steps.push({
      tool: "catalog.get_plant",
      title: "Свериться с карточкой растения",
      args: plant ? plant.nameRu : `растение №${question.plantId}`,
      result: plant ? `свет ${plant.light}, зона ${plant.minZone}, почва: ${plant.soil}` : "карточка не найдена",
    });
  }

  const verdict = diagnose(complaint, facts);

  if (verdict.kind === "refuse") {
    steps.push({
      tool: "consult.suggest_diagnosis",
      title: "Отказался разбирать",
      args: "по описанию",
      result: verdict.message,
    });
    return ok({
      questionId,
      draft: null,
      steps,
      refusal: { message: verdict.message, hint: verdict.hint },
      askAbout: [],
    });
  }

  const { diagnosis } = verdict;
  steps.push({
    tool: "consult.suggest_diagnosis",
    title: "Собрал разбор",
    args: `совпало: ${diagnosis.matched.join(", ")}`,
    result: `уверенность ${diagnosis.confidence} из 3`,
  });

  const [created] = await db.transaction(async (tx) => {
    // Прежний неодобренный черновик заменяется: двух живых быть не должно.
    await tx
      .delete(answerDrafts)
      .where(and(eq(answerDrafts.questionId, questionId), sql`${answerDrafts.approvedAt} is null`));

    const inserted = await tx
      .insert(answerDrafts)
      .values({
        questionId,
        body: diagnosis.body,
        rationale: diagnosis.rationale,
        confidence: diagnosis.confidence,
      })
      .returning();

    if (question.status === "new") {
      await tx.update(questions).set({ status: "in_progress" }).where(eq(questions.id, questionId));
    }
    return inserted;
  });

  return ok({
    questionId,
    draft: {
      id: created.id,
      body: created.body,
      rationale: created.rationale,
      confidence: created.confidence,
      createdAt: created.createdAt.toISOString(),
    },
    steps,
    askAbout: diagnosis.askAbout,
  });
}

/**
 * Единственный путь от черновика к покупателю. Пока эта функция не вызвана,
 * покупатель черновика не видит и видеть не может: он живёт в другой таблице,
 * а getQuestion отдаёт его только агроному.
 */
export async function approveDraft(
  raw: unknown,
  actor: { userId: number; role: UserRole },
): Promise<Result<{ questionId: number; messageId: number; edited: boolean }>> {
  if (actor.role !== "agronomist") return fail("forbidden", "Ответ отправляет агроном");

  const parsed = approveSchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "Проверьте текст ответа", parsed.error.issues);
  const { questionId, editedText } = parsed.data;

  const db = getDb();
  const [draft] = await db
    .select()
    .from(answerDrafts)
    .where(and(eq(answerDrafts.questionId, questionId), sql`${answerDrafts.approvedAt} is null`))
    .orderBy(desc(answerDrafts.createdAt))
    .limit(1);

  if (!draft) return fail("not_found", "Черновика нет — подготовьте его заново");

  const body = editedText ?? draft.body;

  const messageId = await db.transaction(async (tx) => {
    const [message] = await tx
      .insert(messages)
      .values({
        questionId,
        authorId: actor.userId,
        authorRole: "agronomist",
        // Покупателю уходит ровно то, что отправил агроном: правка заменяет
        // текст целиком, а не дописывается к черновику.
        body,
      })
      .returning();

    await tx
      .update(answerDrafts)
      .set({ approvedAt: new Date(), approvedBy: actor.userId })
      .where(eq(answerDrafts.id, draft.id));

    await tx.update(questions).set({ status: "answered" }).where(eq(questions.id, questionId));
    return message.id;
  });

  return ok({ questionId, messageId, edited: editedText !== undefined && editedText !== draft.body });
}

/** Отклонение: черновик удаляется, покупатель ничего не узнаёт. */
export async function rejectDraft(
  raw: unknown,
  actor: { userId: number; role: UserRole },
): Promise<Result<{ questionId: number; removed: number }>> {
  if (actor.role !== "agronomist") return fail("forbidden", "Черновики ведёт агроном");

  const parsed = questionIdSchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "Неверный вопрос", parsed.error.issues);

  const removed = await getDb()
    .delete(answerDrafts)
    .where(
      and(
        eq(answerDrafts.questionId, parsed.data.questionId),
        sql`${answerDrafts.approvedAt} is null`,
      ),
    )
    .returning({ id: answerDrafts.id });

  return ok({ questionId: parsed.data.questionId, removed: removed.length });
}
