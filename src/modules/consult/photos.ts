import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Хранение фото к вопросам. Обработки нет никакой: файл кладётся как есть —
 * ни сжатия, ни распознавания, ни чтения EXIF. Это заглушка, обозначенная
 * на экране, где ею пользуются (spec §8, «вне скоупа»).
 *
 * Каталог — переменная окружения UPLOAD_DIR: в контейнере это именованный том,
 * локально — папка uploads в корне проекта.
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

/** Больше двух мегабайт демо не принимает: снимок с телефона и так меньше. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type PhotoResult = { ok: true; relativePath: string } | { ok: false; reason: string };

/** Принимает data-URL из формы. Разбор простой и намеренно строгий:
 *  всё, что не похоже на снимок из известных трёх форматов, отклоняется. */
export async function savePhoto(dataUrl: string): Promise<PhotoResult> {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!match) return { ok: false, reason: "Не удалось прочитать файл — приложите снимок заново." };

  const [, mime, payload] = match;
  const extension = EXTENSION[mime];
  if (!extension) return { ok: false, reason: "Подойдёт JPEG, PNG или WebP." };

  const bytes = Buffer.from(payload, "base64");
  if (bytes.byteLength === 0) return { ok: false, reason: "Файл пустой." };
  if (bytes.byteLength > MAX_PHOTO_BYTES) {
    return { ok: false, reason: "Снимок тяжелее двух мегабайт — приложите поменьше." };
  }

  const name = `${randomUUID()}.${extension}`;
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, name), bytes);
  } catch (error) {
    console.error("consult: не удалось сохранить фото", error);
    return { ok: false, reason: "Снимок не сохранился. Вопрос можно отправить и без него." };
  }

  return { ok: true, relativePath: name };
}
