import localFont from "next/font/local";

/**
 * Шрифты лежат в репозитории и подключаются локально: сборка контейнера
 * не должна ходить в сеть — иначе стенд падает вместе с Google Fonts.
 *
 * Оба шрифта вариативные, поэтому файл один на подмножество, а вес задан
 * диапазоном. Латиница и кириллица разнесены по разным начертаниям
 * с unicode-range: браузер подбирает файл на каждый символ, поэтому
 * латинские названия растений и русский текст рисуются одним шрифтом,
 * но качаются двумя маленькими файлами.
 */

/* Диапазоны символов повторяются четыре раза намеренно: аргументы next/font
   разбираются статическим анализом на сборке, и константа туда не подставится —
   «Font loader values must be explicitly written literals». Разбор:
   memory/mistakes/2026-09-10-argumenty-next-font-tolko-literaly.md */

export const loraCyrillic = localFont({
  variable: "--font-lora-cyr",
  src: "../../public/fonts/lora-cyrillic.woff2",
  weight: "400 600",
  display: "swap",
  declarations: [{ prop: "unicode-range", value: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116" }],
});

export const loraLatin = localFont({
  variable: "--font-lora-lat",
  src: "../../public/fonts/lora-latin.woff2",
  weight: "400 600",
  display: "swap",
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }],
});

export const manropeCyrillic = localFont({
  variable: "--font-manrope-cyr",
  src: "../../public/fonts/manrope-cyrillic.woff2",
  weight: "400 600",
  display: "swap",
  declarations: [{ prop: "unicode-range", value: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116" }],
});

export const manropeLatin = localFont({
  variable: "--font-manrope-lat",
  src: "../../public/fonts/manrope-latin.woff2",
  weight: "400 600",
  display: "swap",
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }],
});

/** Класс на <html>: отсюда токены забирают семейства. */
export const fontClassNames = [
  loraCyrillic.variable,
  loraLatin.variable,
  manropeCyrillic.variable,
  manropeLatin.variable,
]
  .filter(Boolean)
  .join(" ");
