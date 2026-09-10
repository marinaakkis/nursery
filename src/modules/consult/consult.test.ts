import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { users } from "@/db/shared-schema";
import { plants } from "@/modules/catalog";
import { diagnose } from "./diagnosis";
import { answerDrafts, messages, questions } from "./schema";
import {
  approveDraft,
  createQuestion,
  draftAnswer,
  getQuestion,
  listQuestions,
  rejectDraft,
} from "./service";

const hasDb = Boolean(process.env.DATABASE_URL);

const createdUsers: number[] = [];
const createdQuestions: number[] = [];

async function makeUser(role: "customer" | "agronomist") {
  const [user] = await getDb()
    .insert(users)
    .values({ name: `Тест ${role} ${Date.now()}${Math.random().toString(36).slice(2, 5)}`, role })
    .returning();
  createdUsers.push(user.id);
  return { userId: user.id, role } as const;
}

async function makeQuestion(customerId: number, text: string, plantId?: number) {
  const created = await createQuestion({ text, plantId }, customerId);
  if (!created.ok) throw new Error(created.error.message);
  createdQuestions.push(created.data.questionId);
  return created.data.questionId;
}

afterAll(async () => {
  if (!hasDb) return;
  const db = getDb();
  if (createdQuestions.length > 0) {
    await db.delete(answerDrafts).where(inArray(answerDrafts.questionId, createdQuestions));
    await db.delete(messages).where(inArray(messages.questionId, createdQuestions));
    await db.delete(questions).where(inArray(questions.id, createdQuestions));
  }
  if (createdUsers.length > 0) await db.delete(users).where(inArray(users.id, createdUsers));
});

describe("разбор жалобы — чистая функция", () => {
  it("узнаёт признак и даёт план из двух-трёх шагов", () => {
    const result = diagnose("листья желтеют снизу, поливаю через день", null);
    expect(result.kind).toBe("diagnosis");
    if (result.kind !== "diagnosis") return;
    expect(result.diagnosis.matched).toContain("жёлтые листья");
    const steps = result.diagnosis.body.split("\n").filter((line) => /^\d\./.test(line));
    expect(steps.length).toBeGreaterThanOrEqual(2);
    expect(steps.length).toBeLessThanOrEqual(3);
    expect(result.diagnosis.askAbout.length).toBeGreaterThan(0);
  });

  it("вопрос про заказ уводит к менеджеру, а не лечит растение", () => {
    const result = diagnose("когда привезут мой заказ, оплата прошла", null);
    expect(result.kind).toBe("refuse");
    if (result.kind !== "refuse") return;
    expect(result.hint).toMatch(/менеджер|заказ/i);
  });

  it("непонятную жалобу не выдумывает, а просит уточнить", () => {
    const result = diagnose("что-то не так, посмотрите пожалуйста", null);
    expect(result.kind).toBe("refuse");
  });

  it("без растения уверенность ниже, чем с карточкой", () => {
    const text = "на листьях появились бурые пятна";
    const withoutPlant = diagnose(text, null);
    const withPlant = diagnose(text, {
      nameRu: "Гортензия",
      light: "partial",
      minZone: 3,
      soil: "влажная слабокислая",
      careLevel: "medium",
    });
    if (withoutPlant.kind !== "diagnosis" || withPlant.kind !== "diagnosis") throw new Error("ожидался разбор");
    expect(withoutPlant.diagnosis.confidence).toBeLessThan(withPlant.diagnosis.confidence);
  });
});

describe.skipIf(!hasDb)("черновик не доходит до покупателя без одобрения", () => {
  it("покупатель не видит черновик, агроном видит", async () => {
    const customer = await makeUser("customer");
    const agronomist = await makeUser("agronomist");
    const [plant] = await getDb().select({ id: plants.id }).from(plants).limit(1);
    const questionId = await makeQuestion(customer.userId, "листья желтеют и опадают", plant.id);

    const drafted = await draftAnswer({ questionId }, agronomist);
    if (!drafted.ok) throw new Error(drafted.error.message);
    expect(drafted.data.draft).not.toBeNull();

    const forAgronomist = await getQuestion({ questionId }, agronomist);
    if (!forAgronomist.ok) throw new Error("агроном не прочитал вопрос");
    expect(forAgronomist.data.draft).not.toBeNull();

    const forCustomer = await getQuestion({ questionId }, customer);
    if (!forCustomer.ok) throw new Error("покупатель не прочитал свой вопрос");
    // Главный инвариант модуля: черновика для покупателя не существует.
    expect(forCustomer.data.draft).toBeNull();
    expect(forCustomer.data.messages.every((m) => m.authorRole === "customer")).toBe(true);
  });

  it("одобрение — единственный путь текста к покупателю", async () => {
    const customer = await makeUser("customer");
    const agronomist = await makeUser("agronomist");
    const questionId = await makeQuestion(customer.userId, "куст вянет, земля сырая");

    await draftAnswer({ questionId }, agronomist);

    const before = await getQuestion({ questionId }, customer);
    if (!before.ok) throw new Error("не прочитался");
    expect(before.data.messages).toHaveLength(1);

    const approved = await approveDraft({ questionId }, agronomist);
    if (!approved.ok) throw new Error(approved.error.message);

    const after = await getQuestion({ questionId }, customer);
    if (!after.ok) throw new Error("не прочитался");
    expect(after.data.messages).toHaveLength(2);
    expect(after.data.messages[1].authorRole).toBe("agronomist");
    expect(after.data.status).toBe("answered");
  });

  it("правка агронома уходит покупателю дословно, черновик — нет", async () => {
    const customer = await makeUser("customer");
    const agronomist = await makeUser("agronomist");
    const questionId = await makeQuestion(customer.userId, "на листьях бурые пятна после дождей");

    const drafted = await draftAnswer({ questionId }, agronomist);
    if (!drafted.ok || !drafted.data.draft) throw new Error("черновик не создался");
    const draftBody = drafted.data.draft.body;

    const myText = "Это не грибок. Уберите нижние листья и не поливайте по кроне.";
    await approveDraft({ questionId, editedText: myText }, agronomist);

    const after = await getQuestion({ questionId }, customer);
    if (!after.ok) throw new Error("не прочитался");
    const sent = after.data.messages[1].body;
    expect(sent).toBe(myText);
    expect(sent).not.toBe(draftBody);
  });

  it("отклонённый черновик исчезает и покупателю ничего не уходит", async () => {
    const customer = await makeUser("customer");
    const agronomist = await makeUser("agronomist");
    const questionId = await makeQuestion(customer.userId, "тля на молодых побегах");

    await draftAnswer({ questionId }, agronomist);
    const rejected = await rejectDraft({ questionId }, agronomist);
    if (!rejected.ok) throw new Error(rejected.error.message);
    expect(rejected.data.removed).toBe(1);

    const forAgronomist = await getQuestion({ questionId }, agronomist);
    if (!forAgronomist.ok) throw new Error("не прочитался");
    expect(forAgronomist.data.draft).toBeNull();

    const forCustomer = await getQuestion({ questionId }, customer);
    if (!forCustomer.ok) throw new Error("не прочитался");
    expect(forCustomer.data.messages).toHaveLength(1);
  });

  it("одобрять нечего, если черновика нет", async () => {
    const customer = await makeUser("customer");
    const agronomist = await makeUser("agronomist");
    const questionId = await makeQuestion(customer.userId, "пятна на листьях смородины");

    const result = await approveDraft({ questionId }, agronomist);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_found");
  });
});

describe.skipIf(!hasDb)("права", () => {
  it("чужой вопрос покупателю не открывается", async () => {
    const owner = await makeUser("customer");
    const stranger = await makeUser("customer");
    const questionId = await makeQuestion(owner.userId, "листья вянут на солнце");

    const result = await getQuestion({ questionId }, stranger);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("forbidden");
  });

  it("покупатель не может подготовить или одобрить черновик", async () => {
    const customer = await makeUser("customer");
    const questionId = await makeQuestion(customer.userId, "жёлтые листья у гортензии");

    const drafted = await draftAnswer({ questionId }, customer);
    expect(drafted.ok).toBe(false);
    const approved = await approveDraft({ questionId }, customer);
    expect(approved.ok).toBe(false);
  });

  it("агроном видит все вопросы, покупатель — только свои", async () => {
    const one = await makeUser("customer");
    const two = await makeUser("customer");
    const agronomist = await makeUser("agronomist");
    const first = await makeQuestion(one.userId, "листья желтеют у сирени");
    const second = await makeQuestion(two.userId, "тля на розе");

    const mine = await listQuestions(one);
    if (!mine.ok) throw new Error("не прочиталось");
    expect(mine.data.some((q) => q.id === first)).toBe(true);
    expect(mine.data.some((q) => q.id === second)).toBe(false);

    const all = await listQuestions(agronomist);
    if (!all.ok) throw new Error("не прочиталось");
    expect(all.data.some((q) => q.id === first)).toBe(true);
    expect(all.data.some((q) => q.id === second)).toBe(true);
  });

  it("склад к вопросам не допускается", async () => {
    const warehouse = { userId: 1, role: "warehouse" as const };
    const result = await listQuestions(warehouse);
    expect(result.ok).toBe(false);
  });
});

describe.skipIf(!hasDb)("вопрос дороже снимка", () => {
  it("битое фото не мешает вопросу сохраниться", async () => {
    const customer = await makeUser("customer");
    // AC12: файл не прочитался, но вопрос обязан уйти, а ошибка — вернуться.
    const created = await createQuestion(
      { text: "листья желтеют, прикладываю снимок", photo: "не-data-url" },
      customer.userId,
    );
    if (!created.ok) throw new Error(created.error.message);
    createdQuestions.push(created.data.questionId);

    expect(created.data.photoSaved).toBe(false);
    expect(created.data.photoError).toBeTruthy();

    const [row] = await getDb()
      .select({ n: sql<number>`count(*)::int` })
      .from(messages)
      .where(eq(messages.questionId, created.data.questionId));
    expect(row.n).toBe(1);
  });
});
