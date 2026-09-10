import type { PlantFilters } from "@/modules/catalog";
import type { AgentPlan, LlmProvider } from "./provider";

/**
 * Детерминированный подбор по ключевым словам. Работает без сети, поэтому
 * продукт показывается и тестируется всегда одинаково. Своей логики поверх
 * данных не имеет: возвращает только фильтры, растения ищет catalog.search_plants.
 */

type Rule = { keys: string[]; apply: (f: PlantFilters) => void; reading: string };

const LIGHT_RULES: Rule[] = [
  {
    keys: ["полутен", "рассеянн", "притен"],
    apply: (f) => (f.light = "partial"),
    reading: "света мало — полутень",
  },
  {
    keys: ["тень", "тени", "тенист", "северная сторона", "под деревь"],
    apply: (f) => (f.light = "shade"),
    reading: "место тенистое",
  },
  {
    keys: ["солнц", "солнеч", "открыт"],
    apply: (f) => (f.light = "sun"),
    reading: "место солнечное",
  },
];

const CARE_RULES: Rule[] = [
  {
    keys: ["без ухода", "не ухаживать", "некогда", "по будням", "неприхотлив", "минимум ухода", "забывчив"],
    apply: (f) => (f.care = "low"),
    reading: "ухода минимум",
  },
  {
    keys: ["готов ухаживать", "люблю возиться", "не боюсь ухода"],
    apply: (f) => (f.care = "high"),
    reading: "уход не пугает",
  },
];

const SEASON_RULES: Rule[] = [
  { keys: ["весной", "весна", "весну"], apply: (f) => (f.season = "spring"), reading: "сажать весной" },
  { keys: ["осенью", "осень"], apply: (f) => (f.season = "autumn"), reading: "сажать осенью" },
];

/** 🔶 Соответствия «регион → зона морозостойкости». В спеке их нет; зоны взяты
 *  из docs/demo-plants.md, где ассортимент лежит в диапазоне 2…6. */
const REGION_ZONES: { keys: string[]; zone: number; reading: string }[] = [
  { keys: ["сибир", "заполяр", "якут"], zone: 2, reading: "зона 2 — Сибирь" },
  { keys: ["урал", "север", "архангельск", "карел"], zone: 3, reading: "зона 3 — север" },
  { keys: ["подмосков", "средняя полоса", "москв", "ленинград", "петербург"], zone: 4, reading: "зона 4 — средняя полоса" },
  { keys: ["чернозем", "воронеж", "ростов"], zone: 5, reading: "зона 5 — чернозёмная полоса" },
  { keys: ["юг", "краснодар", "кубан", "крым", "сочи"], zone: 6, reading: "зона 6 — юг" },
];

/** Слышим, но фильтром сделать не можем: таких полей в каталоге нет. */
const UNSUPPORTED: { keys: string[]; note: string }[] = [
  { keys: ["глин", "суглин"], note: "про глинистую почву — в каталоге фильтра по почве нет, смотрите строку «почва» в карточке" },
  { keys: ["песчан", "песок"], note: "про песчаную почву — фильтра по почве нет, смотрите строку «почва» в карточке" },
  { keys: ["кисл", "торф"], note: "про кислую почву — фильтра по почве нет, смотрите строку «почва» в карточке" },
  { keys: ["всё лето", "все лето", "долго цвет", "цветение длит"], note: "про долгое цветение — такого фильтра нет, но срок цветения описан в карточке" },
  { keys: ["живая изгородь", "изгород"], note: "про живую изгородь — отдельного признака нет, ориентируйтесь на описание" },
];

/** Явно не про подбор растений. */
const OFF_TOPIC: { keys: string[]; message: string; hint: string }[] = [
  {
    keys: ["болезн", "желте", "вянет", "пятна", "вредител", "тля", "гниль", "сохнет", "погибает", "что с ним"],
    message: "Я подбираю растения под участок и не ставлю диагнозы.",
    hint: "С больным растением помогут в разделе вопросов агроному — приложите фото.",
  },
  {
    keys: ["доставк", "курьер", "привез", "другой город", "самовывоз", "когда привезут"],
    message: "Я подбираю растения, а условия получения не рассчитываю.",
    hint: "Способ получения и слоты доставки выбираются на экране оформления заказа.",
  },
  {
    keys: ["верну", "возврат", "жалоб", "чек", "скидк", "промокод", "оплат", "картой"],
    message: "Деньгами, оплатой и возвратами я не занимаюсь.",
    hint: "По заказу пишите в питомник — статус и состав видны на странице заказа.",
  },
];

/** Слова, по которым видно, что речь всё-таки про подбор. */
const TOPIC_HINTS = [
  "растен", "посад", "подбер", "подбор", "участок", "куст", "цвет", "сад", "клумб",
  "саженц", "многолетн", "дерев", "газон", "грядк", "тень", "солнц", "полутен",
];

const normalize = (text: string): string => text.toLowerCase().replace(/ё/g, "е");

const hasAny = (text: string, keys: string[]): boolean =>
  keys.some((key) => text.includes(normalize(key)));

export class RulesProvider implements LlmProvider {
  readonly name = "rules";

  async plan(request: string): Promise<AgentPlan> {
    // «ё» приводим к «е» с обеих сторон: иначе «всё лето» и «все лето» — разные ключи.
    const normalized = normalize(request);

    for (const off of OFF_TOPIC) {
      if (hasAny(normalized, off.keys)) {
        return { kind: "refuse", message: off.message, hint: off.hint };
      }
    }

    const filters: PlantFilters = {};
    const reading: string[] = [];

    for (const group of [LIGHT_RULES, CARE_RULES, SEASON_RULES]) {
      for (const rule of group) {
        if (hasAny(normalized, rule.keys)) {
          rule.apply(filters);
          reading.push(rule.reading);
          break;
        }
      }
    }

    // Зона числом имеет приоритет над регионом: она сказана прямо.
    const zoneMatch = normalized.match(/зона\s*(\d)|(\d)\s*зона/);
    const zoneDigit = Number(zoneMatch?.[1] ?? zoneMatch?.[2]);
    if (Number.isInteger(zoneDigit) && zoneDigit >= 2 && zoneDigit <= 6) {
      filters.zone = zoneDigit;
      reading.push(`зона ${zoneDigit}`);
    } else {
      for (const region of REGION_ZONES) {
        if (hasAny(normalized, region.keys)) {
          filters.zone = region.zone;
          reading.push(region.reading);
          break;
        }
      }
    }

    const unsupported = UNSUPPORTED.filter((u) => hasAny(normalized, u.keys)).map((u) => u.note);

    const aboutPlants = hasAny(normalized, TOPIC_HINTS);
    if (reading.length === 0 && unsupported.length === 0 && !aboutPlants) {
      return {
        kind: "refuse",
        message: "Это не про подбор растений — тут я не помощник.",
        hint: "Опишите участок: сколько света, какая зона или регион, сколько времени на уход.",
      };
    }

    return { kind: "pick", filters, reading, unsupported };
  }
}
