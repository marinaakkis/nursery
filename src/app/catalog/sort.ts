/**
 * Порядок выдачи растений: сначала то, что можно купить прямо сейчас,
 * потом остатки, в конце — закончившееся. Внутри группы — по алфавиту.
 *
 * Растение без остатка из каталога не убирается: покупатель должен видеть
 * ассортимент целиком. Но и занимать первый экран оно не должно.
 *
 * 🔶 Живёт в интерфейсе, а не в catalog/service.ts, потому что остаток —
 * дело модуля warehouse, а catalog его не импортирует: warehouse уже
 * импортирует catalog, и обратная ссылка замкнула бы модули в цикл.
 * Каталог отдаёт растения, склад — остатки, экран складывает.
 */

/** Тот же порог «мало осталось», что и на складе. */
export const LOW_STOCK = 3;

export type WithStock = { nameRu: string; available?: number };

/** 0 — есть, 1 — мало, 2 — нет. Неизвестный остаток считаем наличием:
 *  лучше показать растение выше, чем спрятать его из-за незагруженных данных. */
export function stockRank(available: number | undefined): number {
  if (available === undefined) return 0;
  if (available === 0) return 2;
  if (available <= LOW_STOCK) return 1;
  return 0;
}

export function byStockThenName<T extends WithStock>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      stockRank(a.available) - stockRank(b.available) ||
      a.nameRu.localeCompare(b.nameRu, "ru"),
  );
}
