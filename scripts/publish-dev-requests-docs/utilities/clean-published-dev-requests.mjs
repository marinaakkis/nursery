// clean-published-dev-requests.mjs — полное удаление папки опубликованного dev-request.
// Выполняется автоматически после каждой успешной публикации.
// Удаляет всё содержимое и саму папку. git-agent-no-staging: только fs, без git.
// Node.js 18+ ESM, stdlib-only.

import { rmSync, existsSync } from 'node:fs';

// Возвращает план удаления для отображения в dry-run.
export function planClean(dir, manifest) {
  return {
    dir,
    toDelete: manifest.map((a) => a.relativePath),
  };
}

// Удаляет папку целиком (все файлы + саму директорию).
// На Windows может возникнуть EPERM/EBUSY если файлы открыты другим процессом.
export function applyClean(plan) {
  if (!existsSync(plan.dir)) return { dir: plan.dir };
  try {
    rmSync(plan.dir, { recursive: true, force: true });
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'ENOTEMPTY') {
      throw new Error(
        `[clean] Не удалось удалить папку (${err.code}): ${plan.dir}\n` +
        `  Артефакты уже опубликованы. Закройте файлы в IDE/Explorer и удалите вручную:\n` +
        `  Windows: rmdir /s /q "${plan.dir}"\n` +
        `  Linux/macOS: rm -rf "${plan.dir}"`,
      );
    }
    throw err;
  }
  return { dir: plan.dir };
}
