import { daysWord } from "../catalog/filters";

export const todayIso = (): string => new Date().toISOString().slice(0, 10);

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000,
  );
}

/** «сегодня» / «через 2 дня» / «просрочено на 3 дня» — человеческим языком,
 *  а не датой: покупатель думает сроками, а не числами календаря. */
export function whenWord(plannedOn: string, today = todayIso()): string {
  const days = daysBetween(today, plannedOn);
  if (days === 0) return "сегодня";
  if (days === 1) return "завтра";
  if (days > 0) return `через ${days} ${daysWord(days)}`;
  const late = Math.abs(days);
  return `просрочено на ${late} ${daysWord(late)}`;
}

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

const WEEKDAYS = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

export function humanDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

export function weekdayOf(iso: string): string {
  return WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

export function shiftIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** «2 события» / «1 событие» / «5 событий». */
export function eventsWord(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return "событий";
  if (mod10 === 1) return "событие";
  if (mod10 >= 2 && mod10 <= 4) return "события";
  return "событий";
}
