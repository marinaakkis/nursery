/** Словарь фильтров каталога: значения совпадают с plantFiltersSchema модуля,
 *  подписи — русские. Своей логики отбора здесь нет, только соответствие
 *  «значение API → подпись на экране». */

export type FacetKey = "light" | "zone" | "season" | "care";

export type Facet = {
  key: FacetKey;
  /** Заголовок группы в панели фильтров. */
  title: string;
  /** Что снимается — уходит в aria-label крестика: «Убрать фильтр: свет — тень». */
  subject: string;
  options: { value: string; label: string }[];
};

export const FACETS: Facet[] = [
  {
    key: "light",
    title: "Свет",
    subject: "свет",
    options: [
      { value: "sun", label: "Солнце" },
      { value: "partial", label: "Полутень" },
      { value: "shade", label: "Тень" },
    ],
  },
  {
    key: "zone",
    // Фильтр отбирает растения, которые переживут зиму в этой зоне: minZone <= zone.
    title: "Зона участка",
    subject: "зона",
    options: [2, 3, 4, 5, 6].map((zone) => ({ value: String(zone), label: String(zone) })),
  },
  {
    key: "season",
    title: "Сезон посадки",
    subject: "сезон посадки",
    options: [
      { value: "spring", label: "Весна" },
      { value: "autumn", label: "Осень" },
      { value: "spring_autumn", label: "Весна и осень" },
    ],
  },
  {
    key: "care",
    title: "Уход",
    subject: "уход",
    options: [
      { value: "low", label: "Низкий" },
      { value: "medium", label: "Средний" },
      { value: "high", label: "Высокий" },
    ],
  },
];

export type Selection = Partial<Record<FacetKey, string>>;

export function readSelection(params: URLSearchParams): Selection {
  const selection: Selection = {};
  for (const facet of FACETS) {
    const value = params.get(facet.key);
    if (value && facet.options.some((o) => o.value === value)) selection[facet.key] = value;
  }
  return selection;
}

export function toQuery(selection: Selection): string {
  const params = new URLSearchParams();
  for (const facet of FACETS) {
    const value = selection[facet.key];
    if (value) params.set(facet.key, value);
  }
  return params.toString();
}

export function labelOf(key: FacetKey, value: string): string {
  const facet = FACETS.find((f) => f.key === key);
  return facet?.options.find((o) => o.value === value)?.label ?? value;
}

/** «12 растений» / «1 растение» / «2 растения». */
export function plantsWord(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return "растений";
  if (mod10 === 1) return "растение";
  if (mod10 >= 2 && mod10 <= 4) return "растения";
  return "растений";
}

export function formatPrice(priceCents: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(priceCents / 100))} ₽`;
}
