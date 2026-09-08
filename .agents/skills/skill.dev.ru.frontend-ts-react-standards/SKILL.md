---
name: skill.dev.ru.frontend-ts-react-standards
description: >-
  Applies corporate frontend coding conventions for TypeScript, JavaScript,
  CSS/Styles and React (naming, structure, formatting, imports order,
  destructuring, JSDoc/TSDoc, atomic design, ESLint/Stylelint/Prettier config).
  Use when writing, refactoring, or reviewing TypeScript/JavaScript/React code,
  creating components, interfaces, enums, DTO models, CSS modules, or when the
  user asks for code that matches the corporate frontend style guide.
---

# Frontend: TypeScript / JavaScript / React — стандарты кодирования

## Область применения

Скилл задаёт корпоративные правила для TypeScript/JavaScript/React-кода, CSS Modules и проектных конфигов (ESLint/Stylelint/Prettier) в frontend-контуре.

Границы применения:
- для feature-архитектуры и клиентских контрактов приоритет имеет `skill.arch.ru.frontend-clean-architecture`;
- этот скилл применяется как кодстайл- и implementation-level дополнение;
- legacy-допуски не расширяют требования к новому коду.

## Когда применять

Применяй скилл, когда задача связана с:
- созданием или рефакторингом React-компонентов, hooks, stores, DTO, CSS Modules;
- ревью TypeScript/JavaScript-кода на соответствие корпоративным соглашениям;
- настройкой/проверкой ESLint, Stylelint, Prettier, Vite и сопутствующих frontend-конфигов.

## Переопределения относительно universal baseline

Относительно `skill.dev.ru.coding-standards-universal` этот скилл переопределяет:
- стиль скобок на Egyptian (вместо Allman);
- лимит длины строки до 120 символов;
- лимит длины функции до 50 строк;
- frontend-специфичные правила именования файлов, типов, CSS и структуры атомарного дизайна.

> Базовые принципы именования, структуры и форматирования — `skill.dev.ru.coding-standards-universal`. Ниже — TypeScript/React-специфика и переопределения (в т.ч. стиль скобок Egyptian, строка ≤120, метод ≤50 строк, SCREAMING_SNAKE_CASE для модульных констант).

Ориентируйся на эти правила для генерируемого и правимого кода (TypeScript, JavaScript, CSS, React), если в проекте нет явно противоречащих инструкций. **Жёстких запретов меньше, чем в источнике:** где возможно, указаны **предпочтения**; окончательное решение — по договорённости команды и ревью.

Машинно проверяемое форматирование и часть стиля заданы в **`.eslintrc.json`**, **`.stylelintrc.json`** и **`.prettierrc.json`** в корне репозитория; при расхождении текста скилла с этими конфигами для чисто синтаксических предпочтений **можно** взять за основу конфиги.

## Именование — сводная таблица

| Идентификатор | Регистр | Пример |
|---|---|---|
| Класс / Компонент React | UpperCamelCase | `InputComponent`, `BirthdaysList` |
| Приватная функция / поле | camelCase с `_` | `_initEvtHandlers`, `_counter` |
| Публичная функция | camelCase (глагол) | `getInvoiceData`, `createVacationsRequests` |
| Публичное свойство | UpperCamelCase | `Amount` |
| Параметр / переменная | camelCase | `typeName`, `someVariable` |
| Константа | SCREAMING_SNAKE_CASE | `LOCAL_CONSTANT`, `TODAY_TEXT` |
| Интерфейс (новый код) | PascalCase | `BirthdayPerson`, `ButtonIconProps` |
| Интерфейс (legacy-допуск) | `I` + PascalCase | `IBirthdayPerson`, `IButtonIconProps` |
| Enum | PascalCase; единственное (простой) / множественное (набор/флаги) | `ProfileAvatarSize`, `ProfileAvatarSizes` |
| Тип (type alias) | PascalCase | `BirthdayPerson`, `ProfileMainInfo` |
| CSS-класс (CSS Modules) | camelCase | `styles.userList`, `styles.navComponent` |
| Файл стилей (CSS Module) | PascalCase.module.css | `BirthdaysList.module.css` |
| Файл иконки / изображения | kebab-case | `arrow-left.svg`, `company-logo.png` |
| CSS переменная цвета | `--kebab-case-NNN` | `--primary-color-500` |
| Файл интерфейса | kebab-case.interface.ts | `profile-avatar-sizes.interface.ts` |
| Файл enum | kebab-case.enum.ts | `profile-avatar-size.enum.ts` |
| Файл типа | kebab-case.type.ts | `profile-avatar-sizes.type.ts` |
| Файл хелпера | kebab-case.helper.ts | `create-text-props.helper.ts` |
| Файл модели | kebab-case.models.ts | `text-component.models.ts` |
| Файл DTO | kebab-case.dto.ts | `users.dto.ts` |

**Обработчики событий** — префикс `on`: `onClick`, `onSubmit`.

**Иконки** — суффикс `Icon` при импорте: `import { ReactComponent as ArrowIcon } from '…'`.

**API-методы запросов:** `post` → `create`, `put`/`patch` → `update`, `get` → `get`; имя строится из HTTP-глагола + сущности из эндпоинта: `createVacationsRequests`, `getVacationsRequests`. Исключение для POST-search: `searchFaqs`.

**Корпоративный префикс файлов и CSS-классов:** файлы сущностей корпоративной ИС и CSS-классы начинаются с префикса **`cmpn-`**: `cmpn-button.component.css`, `.cmpn-button {}`. Команды могут вводить суб-префиксы через дефис (определяются на уровне команды).

**Имя класса/компонента = имя файла (JS):** имя класса должно содержать имя файла, в котором он описан: `input.component.js` → `InputComponent`; дополнительные постфиксы допустимы (`ViewModel`, `Base`).

## Именование типов TypeScript

**Разрешение конфликта со `skill.arch.ru.frontend-clean-architecture`:**
- Архитектурные gateway-контракты (`{Feature}Client`) именуются без `I` (MUST).
- Для нового TS/React-кода интерфейсы именуются без `I` (SHOULD).
- В legacy-коде допускается сохранять `I*` без массового переименования (MAY).
- При конфликте правил между этим скиллом и `skill.arch.ru.frontend-clean-architecture` для feature-слоя применяется `frontend-clean-architecture` (single source of truth).
- Новые архитектурные интерфейсы в формате `I*` не вводить; `I*` допускается только как точечный legacy-допуск.

**Интерфейсы:**
- Файл: `kebab-case.interface.ts`; пропсы: `kebab-case.props.ts`
- Тип (новый код): PascalCase → `BirthdayPerson`; пропсы компонента: `ButtonIconProps`
- Legacy-допуск: `I` + PascalCase → `IBirthdayPerson`; пропсы компонента: `IButtonIconProps`
- В качестве имени: существительное или прилагательное(ые) + существительное

**Enum:**
- Файл: `kebab-case.enum.ts`
- Тип: PascalCase; единственное число для простого enum → `ProfileAvatarSize`; множественное для набора значений / флагов → `ProfileAvatarSizes`; **суффикс `Enum` в имени типа не использовать**
- Значения: без повтора имени типа (правило universal); enum в DTO — строго по серверной модели (swagger)

**Модели (классы DTO):**
- Постфикс `Model` у классов: `TextComponentBaseModel`; DTO: постфикс `Dto` → `UserShortInfoDto`
- Элементы табличных наборов: постфикс `Item` → `ProcessingProcessRegistryItem`

**Generic-параметры:** префикс `T`; описательные имена: `TKey`, `TValue`, `TSession`, `TResult`.

**Utility-types:** именовать согласно документации TS; использовать `Omit`, `Partial` и т.д. без переименования.

## Структура файла

**Порядок импортов** (каждый блок отделяется пустой строкой):
1. Библиотеки: внешние, затем внутренние
2. Компоненты (полный путь): Pages → Templates → Common → Organisms → Molecules → Atoms → Icons → Images
3. Описательные сущности: Models, Interfaces, Types, Enum
4. Остальное: Services, Stores, Clients, Hooks, Utils, Helpers, Constants, Resources, Mocks, Localizations
5. CSS Modules

**Порядок свойств в интерфейсе:** `id`, `name`, `title`, `className` → по мере появления в компоненте → необязательные поля в конце.

**Порядок пропсов в компоненте:** default-пропсы → `{...props}` → фиксированные (не переопределяемые). Boolean-пропс `true` передаётся без значения: `<Comp disabled />`.

## Документация и комментарии

Общая политика (язык, предложения с заглавной буквы, `//` vs `/* */`, две политики проекта, TODO в трекер) — в `skill.dev.ru.coding-standards-universal`.

**TSDoc/JSDoc-специфика:**
- JSDoc/TSDoc нотация; boolean-пропсы — в форме вопроса
- `// @todo fixme:` — аннотирование проблемы; `// @todo:` — указание решения; оба тега дополняются номером задачи трекера
- `@deprecated` — для устаревших сущностей
- Непубличные методы: `@private` / `@protected`; абстрактные — `@abstract`; виртуальные — `@virtual`; переопределяющие — `@override`; статические — `@static`
- rest-параметры в JSDoc — с ведущим `...`: `@param {number} ...numbers — массив аргументов`
- Однострочные `//` — над строкой кода, с пустой строкой перед комментарием

Шаблоны документирования (интерфейсы, функции, enum, DTO) — [reference.md](reference.md).

## Форматирование кода

Базовые правила (4 пробела, одна инструкция на строку, пробелы вокруг операторов, `if`/`else` в `{}`) — в `skill.dev.ru.coding-standards-universal`.

**Переопределения для TypeScript/JS:**
- **Стиль скобок (Egyptian — переопределение universal Allman):** открывающая `{` в той же строке, пробел перед ней
- **Длина строки:** не более **120** символов (universal: 150); более длинные — разбивать
- **Вертикальные отступы:** между переменными, функциями, блоками `if`/`else`, `try`/`catch`; не более 9 строк подряд без отступа
- **Запятые:** в конце строки (не в начале); trailing comma разрешена в ES6+
- **Строки:** одинарные кавычки `' '`; в ES6+ — template literals вместо конкатенации; строки >80 символов — переносить

**Prettier:** `printWidth: 120`, `tabWidth: 4`, `singleQuote: true`, `bracketSpacing: true`, `useTabs: false`.

## Работа с переменными

Базовые правила (одна переменная на оператор, близко к использованию, осмысленные имена) — в `skill.dev.ru.coding-standards-universal`.

**TypeScript/JS-специфика и переопределения:**
- **ES6+:** `const` — для неизменяемых, `let` — для изменяемых; `var` не использовать в новом коде; `var` допустим только в legacy-файлах без ES-модулей/без современного bundler/transpiler
- **Однобуквенные имена (переопределение universal):** разрешены только для счётчика цикла `i`; в `for...in` — **запрещены**
- Объявлять близко к месту использования (блочный скоуп `const`/`let` делает «объявление в начале функции» избыточным)
- Объекты — через `{}`; массивы — через `[]`; push для добавления элементов
- **Деструктуризация:** объявлять только используемые переменные; при >=5 свойствах — алфавитный порядок; rest-синтаксис вместо `arguments`; spread вместо `.concat`/`.slice.call`
- **Строки:** template literals для динамических строк; одинарные кавычки — см. `Форматирование кода`
- **Объекты:** не использовать зарезервированные слова как ключи; не смешивать структурный и словарный способы объявления свойств; точечная нотация для доступа, `[]` только при динамическом ключе

## Функции

Базовые правила (≤5 параметров, именованные аргументы, минимизация мутаций, guard clause) — в `skill.dev.ru.coding-standards-universal`.

**TypeScript/JS-специфика и переопределения:**
- **Длина (переопределение universal 90):** до **50** строк; если больше — разбить на несколько
- Стрелочные функции — предпочтительны (нет собственного `this`)
- Не объявлять функции внутри блоков (`if`, `for`, `else`); присваивать переменной
- Не использовать `arguments` — применять rest-синтаксис `...rest`
- Аргументы функций должны иметь явную типизацию (тип аргументов и возврата обязательны)
- Имена обработчиков: `elemEvtNameEvtHandler` (JS) или `onEventName` (TS/React)

## Работа со стилями

- CSS-переменные цветов объявляются в `:root` в `global/styles/index.css`; использовать через `var(--color-primary-500)`
- Файл `index.css` — в `global/styles/`; хранит импорты всех стилей и переменных
- **Порядок свойств CSS** (шаблон): `width` → `height` → `position`/top/bottom/left/right → `display` + flex/grid-параметры → box-sizing/border/outline/margin/padding → font → background → box-shadow → opacity → visibility → z-index → transform → transition → resize → user-select
- Псевдоклассы — на том же уровне, что и класс; вложенность — отступ 2 пробела
- **Порядок селекторов** в файле — от родителя к потомку; псевдоклассы/псевдоэлементы сразу за своим селектором
- Stylelint конфигурация закрепляет порядок свойств (см. [reference.md](reference.md))

## Структура проекта (атомарный дизайн)

| Уровень | Что содержит | Правило позиционирования |
|---|---|---|
| Atom | HTML-элементы, без дочерних компонентов | Без отступов и позиций |
| Molecule | Атомы + HTML; небольшая деталь UI | Молекула/организм задаёт позицию атомам |
| Organism | Организмы + молекулы + атомы + HTML | Корпоративная конвенция: не имеет собственных стилей/позиции |
| Template | Размещает компоненты в сетку | Только сетка страницы |
| Page | Применяет шаблон с реальным контентом | Связывает всё приложение |

**Атомарный принцип:** атомы без позиций; молекулы/организмы задают позиции атомам; для organism правило «без собственных стилей/позиции» — корпоративное отклонение для единообразия UI; шаблоны только сетка; страницы отображают шаблоны.

**Общая структура JS-проекта:** отдельные директории `components`, `shared`; поддиректории `models`, `interfaces`, `enums` при необходимости; домен — в `domain/`; entry-point файлы — в корне; базовые классы — префикс `base`; дочерние классы в субдиректории родительского файла.

**React — верхнеуровневая структура** (сохранять):
`dist/` (бандлы), `public/` (index.html, favicon, статика), `src/` (код приложения), `node_modules/`, `package.json`, `README.md`.

## .env и скрипты сборки (React)

- Для новых Vite-проектов переменные окружения в клиенте — только с префиксом `VITE_`
- Для legacy CRA-проектов допустим префикс `REACT_APP_` без миграции, если нет явной задачи перехода
- Runtime-подмена env для Vite по умолчанию выполняется через отдельный `/env-config.js`, подключаемый в `index.html` (переменные читаются из `window.__env__`)
- Образ не должен зависеть от environment-specific значений на этапе сборки

## Стек и конфигурация (React)

**Обязательный стек:**
- REST API: Axios
- Серверное состояние: **TanStack Query** (новые проекты) — кэширование, фоновые обновления, loading/error states; в legacy без TanStack Query управление через store
- Store: **Zustand** (новые проекты) / MobX + mobx-react (legacy)
- Навигация: react-router-dom
- Стили: CSS Modules + classnames
- Формы: react-hook-form + **Zod** (`@hookform/resolvers/zod`) — валидация схем и DTO; `ts-serializable` допустим в legacy
- Валидация схем: **Zod** — типизированная runtime-валидация; заменяет `ts-serializable` в новых проектах
- Генерация ID: nanoid
- Даты: date-fns + react-datepicker
- Тесты: **Vitest** + **React Testing Library** (новые проекты на Vite); Jest допустим в legacy
- Линтер: ESLint (eslint-plugin-react recommended); форматтер: Prettier

**ESLint:** `standard-with-typescript`, `plugin:react/recommended`, `plugin:react-hooks/recommended`, `import/order` с `newlines-between: always-and-inside-groups`. Конфиг — [reference.md](reference.md). Пример `.eslintrc.*` относится к legacy/ESLint `<9`; для ESLint `9+` использовать flat config (`eslint.config.*`).

**Stylelint:** `stylelint-order` с закреплённым порядком CSS-свойств. Конфиг — [reference.md](reference.md).

**Сборщик:**
- Новые проекты — **Vite** (`npm create vite@latest`); `create-react-app` более не поддерживается и **не использовать** в новых проектах.
- Legacy-проекты на `create-react-app` — допустимо оставлять без миграции, если нет явной задачи перехода.
- Next.js — `create-next-app` по-прежнему актуален для SSR/SSG.

**TypeScript (новые проекты):**
- `"strict": true` в `tsconfig.json` — обязательно; при необходимости отдельные флаги (`noUncheckedIndexedAccess` и др.) по договорённости команды.
- Path alias `@/` → `src/` в `vite.config.ts` и `tsconfig.json` — устраняет длинные относительные пути.

**React:** компоненты именуются как классы — UpperCamelCase; ESLint обязателен.

## Ошибки и доступность (a11y)

- Для запросов через TanStack Query обязательно обрабатывать `error`-состояние в UI (экран/блок ошибки, сообщение пользователю, сценарий retry при необходимости).
- Для критичных UI-деревьев (страницы/крупные виджеты) использовать Error Boundaries, чтобы локализовать runtime-сбои.
- Для форм и интерактивных компонентов соблюдать базовую доступность: семантическая HTML-разметка, корректные `label`-`control` связи, `aria-*` атрибуты по смыслу, `alt` у изображений, доступность с клавиатуры.

## Перед сдачей (чеклист)

1. Имена файлов соответствуют таблице (kebab-case с суффиксом `.interface`, `.enum`, `.type`, `.dto`, `.models`, `.helper`, `.module.css`).
2. Типы, интерфейсы, enum, DTO — с корректными суффиксами; для нового кода интерфейсы без `I`, `I*` допустим только в legacy без массового rename.
3. Порядок импортов в файле соответствует 5 блокам.
4. Форматирование согласовано с Prettier (`printWidth: 120`, 4 пробела, одинарные кавычки).
5. CSS-свойства в правильном порядке; классы в camelCase, файлы стилей в PascalCase.module.css.
6. Переменные через `const`/`let` в новом коде; нет `arguments` — только rest; нет однобуквенных имён в `for...in`.
7. Функции ≤50 строк; обработчики с правильным префиксом `on` / суффиксом `EvtHandler`.
8. TSDoc-комментарии на публичные сущности (если политика — legacy или библиотека).
9. Компоненты React размещены в правильном уровне атомарного дизайна.
10. ESLint и Stylelint не дают ошибок.
11. Новый проект: `strict: true` в `tsconfig.json`, path alias `@/` настроен, Vitest/RTL подключены.

Подробные примеры и конфигурации — [reference.md](reference.md).
