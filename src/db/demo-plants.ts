/** Ассортимент демо-данных. Источник для сида и для docs/demo-plants.md.
 *  Зоны USDA — минимальная, в которой растение зимует в открытом грунте. */
export type DemoPlant = {
  nameRu: string;
  nameLat: string;
  light: "sun" | "partial" | "shade";
  minZone: number;
  plantingSeason: "spring" | "autumn" | "spring_autumn";
  careLevel: "low" | "medium" | "high";
  soil: string;
  priceCents: number;
  description: string;
};

export const demoPlants: DemoPlant[] = [
  { nameRu: "Пузыреплодник калинолистный", nameLat: "Physocarpus opulifolius", light: "sun", minZone: 2, plantingSeason: "spring_autumn", careLevel: "low", soil: "любая садовая, дренированная", priceCents: 69000, description: "Плотный кустарник с пурпурной листвой. Держит стрижку, растёт почти на любой почве." },
  { nameRu: "Дёрен белый", nameLat: "Cornus alba", light: "partial", minZone: 2, plantingSeason: "spring_autumn", careLevel: "low", soil: "влажная, выносит глину", priceCents: 62000, description: "Красные побеги зимой. Один из немногих кустарников, спокойно растущих на тяжёлой глине." },
  { nameRu: "Жимолость съедобная", nameLat: "Lonicera caerulea", light: "partial", minZone: 2, plantingSeason: "autumn", careLevel: "low", soil: "суглинок, умеренно влажный", priceCents: 78000, description: "Первая ягода сезона. Для урожая нужны два разных сорта рядом." },
  { nameRu: "Ирга ольхолистная", nameLat: "Amelanchier alnifolia", light: "sun", minZone: 2, plantingSeason: "spring_autumn", careLevel: "low", soil: "любая, выносит бедную", priceCents: 85000, description: "Неприхотливый крупный куст: цветение весной, ягоды летом, багрянец осенью." },
  { nameRu: "Страусник обыкновенный", nameLat: "Matteuccia struthiopteris", light: "shade", minZone: 2, plantingSeason: "spring", careLevel: "low", soil: "влажная лесная", priceCents: 46000, description: "Папоротник-воронка до метра. Закрывает глухую тень, где больше ничего не растёт." },
  { nameRu: "Сирень обыкновенная", nameLat: "Syringa vulgaris", light: "sun", minZone: 3, plantingSeason: "spring_autumn", careLevel: "low", soil: "суглинок, нейтральная реакция", priceCents: 120000, description: "Классический куст палисадника. Не любит кислую почву и подтопление." },
  { nameRu: "Гортензия метельчатая", nameLat: "Hydrangea paniculata", light: "partial", minZone: 3, plantingSeason: "spring", careLevel: "medium", soil: "влажная слабокислая", priceCents: 145000, description: "Цветёт с июля до заморозков. Требует регулярного полива и обрезки весной." },
  { nameRu: "Калина обыкновенная", nameLat: "Viburnum opulus", light: "partial", minZone: 3, plantingSeason: "autumn", careLevel: "low", soil: "влажная, выносит сырость", priceCents: 89000, description: "Терпит близкие грунтовые воды. Ягоды остаются на кусте до зимы." },
  { nameRu: "Рябина обыкновенная", nameLat: "Sorbus aucuparia", light: "sun", minZone: 3, plantingSeason: "autumn", careLevel: "low", soil: "суглинок", priceCents: 110000, description: "Дерево второй величины. Хорошо переносит городские условия и ветер." },
  { nameRu: "Смородина чёрная", nameLat: "Ribes nigrum", light: "sun", minZone: 3, plantingSeason: "autumn", careLevel: "medium", soil: "плодородная влажная", priceCents: 54000, description: "Урожай со второго года. Нужна вырезка старых веток и полив в засуху." },
  { nameRu: "Крыжовник обыкновенный", nameLat: "Ribes uva-crispa", light: "sun", minZone: 3, plantingSeason: "autumn", careLevel: "medium", soil: "дренированная суглинистая", priceCents: 56000, description: "Не переносит замокания корней. Требует прореживания куста каждую весну." },
  { nameRu: "Хоста Форчуна", nameLat: "Hosta fortunei", light: "shade", minZone: 3, plantingSeason: "spring", careLevel: "low", soil: "влажная плодородная", priceCents: 48000, description: "Основа теневого цветника. Единственный настоящий враг — слизни." },
  { nameRu: "Бруннера крупнолистная", nameLat: "Brunnera macrophylla", light: "shade", minZone: 3, plantingSeason: "spring_autumn", careLevel: "low", soil: "влажная, выносит глину", priceCents: 43000, description: "Серебристые листья и голубые цветки. Растёт в тени на тяжёлой почве." },
  { nameRu: "Пион молочноцветковый", nameLat: "Paeonia lactiflora", light: "sun", minZone: 3, plantingSeason: "autumn", careLevel: "medium", soil: "суглинок, нейтральная реакция", priceCents: 135000, description: "Живёт на одном месте десятилетиями. Сажать только осенью и неглубоко." },
  { nameRu: "Лилейник гибридный", nameLat: "Hemerocallis hybrida", light: "sun", minZone: 3, plantingSeason: "spring_autumn", careLevel: "low", soil: "любая садовая", priceCents: 59000, description: "Цветёт без ухода. Подходит для участка, куда приезжают по выходным." },
  { nameRu: "Роза морщинистая", nameLat: "Rosa rugosa", light: "sun", minZone: 3, plantingSeason: "spring_autumn", careLevel: "low", soil: "песчаная дренированная", priceCents: 98000, description: "Зимует без укрытия. Держит склон и растёт у моря на песке." },
  { nameRu: "Купена многоцветковая", nameLat: "Polygonatum multiflorum", light: "shade", minZone: 3, plantingSeason: "autumn", careLevel: "low", soil: "рыхлая лесная", priceCents: 42000, description: "Дуги побегов с белыми колокольчиками. Разрастается сама, ухода не требует." },
  { nameRu: "Спирея японская", nameLat: "Spiraea japonica", light: "sun", minZone: 4, plantingSeason: "spring_autumn", careLevel: "low", soil: "любая дренированная", priceCents: 64000, description: "Невысокий бордюрный куст. Цветёт всё лето, стрижку переносит легко." },
  { nameRu: "Чубушник венечный", nameLat: "Philadelphus coronarius", light: "sun", minZone: 4, plantingSeason: "autumn", careLevel: "low", soil: "суглинок", priceCents: 82000, description: "Тот самый «жасмин» с сильным запахом в июне. Обрезка сразу после цветения." },
  { nameRu: "Барбарис Тунберга", nameLat: "Berberis thunbergii", light: "sun", minZone: 4, plantingSeason: "spring", careLevel: "low", soil: "дренированная, без застоя воды", priceCents: 71000, description: "Яркая листва весь сезон. Колючий — хорош как живая изгородь." },
  { nameRu: "Астильба Арендса", nameLat: "Astilbe arendsii", light: "shade", minZone: 4, plantingSeason: "spring", careLevel: "medium", soil: "влажная слабокислая", priceCents: 52000, description: "Метёлки в полутени. Не прощает пересыхания почвы даже на несколько дней." },
  { nameRu: "Хоста подорожниковая", nameLat: "Hosta plantaginea", light: "shade", minZone: 4, plantingSeason: "spring", careLevel: "low", soil: "влажная плодородная", priceCents: 51000, description: "Крупные глянцевые листья и душистые белые цветки в августе." },
  { nameRu: "Гейхера гибридная", nameLat: "Heuchera hybrida", light: "partial", minZone: 4, plantingSeason: "spring", careLevel: "medium", soil: "рыхлая дренированная", priceCents: 47000, description: "Декоративна листвой с апреля по ноябрь. Требует деления раз в три года." },
  { nameRu: "Флокс метельчатый", nameLat: "Phlox paniculata", light: "sun", minZone: 4, plantingSeason: "spring_autumn", careLevel: "medium", soil: "плодородная умеренно влажная", priceCents: 61000, description: "Аромат августовского сада. В загущённой посадке болеет мучнистой росой." },
  { nameRu: "Клематис Жакмана", nameLat: "Clematis jackmanii", light: "sun", minZone: 4, plantingSeason: "spring", careLevel: "high", soil: "плодородная, основание в тени", priceCents: 129000, description: "Лиана до трёх метров. Голова на солнце, ноги в тени — иначе не цветёт." },
  { nameRu: "Рододендрон Ледебура", nameLat: "Rhododendron ledebourii", light: "partial", minZone: 4, plantingSeason: "spring", careLevel: "high", soil: "кислая торфяная", priceCents: 168000, description: "Цветёт до распускания листьев. Обязателен кислый субстрат и мульча." },
  { nameRu: "Вейгела цветущая", nameLat: "Weigela florida", light: "sun", minZone: 5, plantingSeason: "spring", careLevel: "medium", soil: "плодородная дренированная", priceCents: 94000, description: "Обильное цветение в июне и повторное в конце лета. В зоне 5 требует укрытия." },
  { nameRu: "Самшит вечнозелёный", nameLat: "Buxus sempervirens", light: "partial", minZone: 6, plantingSeason: "spring", careLevel: "medium", soil: "плодородная дренированная", priceCents: 115000, description: "Вечнозелёный бордюр под стрижку. Южнее зоны 6 зимует без забот, севернее — нет." },
  { nameRu: "Лаванда узколистная", nameLat: "Lavandula angustifolia", light: "sun", minZone: 5, plantingSeason: "spring", careLevel: "medium", soil: "бедная известковая, сухая", priceCents: 56000, description: "Не выносит сырости и жирной почвы. На зиму нужен сухой воздушный укрывной слой." },
  { nameRu: "Магнолия Суланжа", nameLat: "Magnolia soulangeana", light: "sun", minZone: 6, plantingSeason: "spring", careLevel: "high", soil: "плодородная слабокислая", priceCents: 240000, description: "Крупные цветки до листьев. Место без ветра обязательно, возвратные заморозки губят бутоны." },
];

/** Периодичность ухода выводится из уровня ухода: календарь не должен быть пустым. */
export const careRulesByLevel = {
  low: [
    { type: "watering" as const, periodDays: 14, seasonOnly: false },
    { type: "feeding" as const, periodDays: 90, seasonOnly: true },
  ],
  medium: [
    { type: "watering" as const, periodDays: 7, seasonOnly: false },
    { type: "feeding" as const, periodDays: 45, seasonOnly: true },
    { type: "pruning" as const, periodDays: 180, seasonOnly: true },
  ],
  high: [
    { type: "watering" as const, periodDays: 4, seasonOnly: false },
    { type: "feeding" as const, periodDays: 30, seasonOnly: true },
    { type: "pruning" as const, periodDays: 120, seasonOnly: true },
  ],
};
