import { describe, expect, it } from "vitest";
import { cleanupTestRows, countTestRows } from "./test-cleanup";

/**
 * Сторож уборки. Раньше служебные растения оставались в каталоге и попадали
 * на экран покупателю; заметил это человек, а не проверка. Теперь проверка есть.
 *
 * Файл называется так, чтобы идти последним по алфавиту внутри src/db —
 * порядок между файлами vitest не гарантирует, поэтому сторож сначала сам
 * убирает, а потом требует ноль: это делает его верным независимо от порядка.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("уборка служебных записей", () => {
  it("после уборки в базе не остаётся ни одной служебной записи", async () => {
    const failed = await cleanupTestRows();
    expect(failed, "шаги уборки, которые не прошли").toEqual([]);

    const left = await countTestRows();
    expect(left).toEqual({ plants: 0, users: 0 });
  });
});
