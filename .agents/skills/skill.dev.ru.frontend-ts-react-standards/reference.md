---
name: skill.dev.ru.frontend-ts-react-standards.reference
description: >-
  Reference examples for frontend TypeScript/React standards: naming,
  documentation, formatting, linting, forms, data fetching, Vite and tests.
---

# Frontend TS/React — справочник (примеры и конфиги)

Дополнение к `SKILL.md`. Читай при сомнениях в документировании, именовании или конфигурации инструментов.

## TSDoc — интерфейс пропсов

```typescript
/**
 * Интерфейс текстового поля.
 * @prop {TEditableRowNames} fieldName - Название поля.
 * @prop {string} value - Значение поля.
 * @prop {number} maxLength - Максимальное значение количества символов поля.
 * @prop {boolean} isActiveButton - Кнопка активна?
 * @prop {UsersStore | undefined} usersStore - Хранилище пользователей.
 */
interface ITextFieldProps {
    fieldName: TEditableRowNames;
    value: string;
    maxLength: number;
    isActiveButton: boolean;
    usersStore?: UsersStore;
}
```

## TSDoc — расширяемый интерфейс

```typescript
/**
 * Интерфейс секции ссылок футера.
 * @extends {IBaseComponent}
 * @prop {string} chapter - Раздел секции.
 */
interface ISectionFooterLinks extends IBaseComponent {
    chapter: string;
}
```

## TSDoc — enum

```typescript
/**
 * Вариации размеров аватарки.
 * @enum
 * @member {string} small - Малый размер.
 * @member {string} middle - Средний размер.
 */
export enum ProfileAvatarSizes {
    small = 'SMALL',
    middle = 'MIDDLE',
}
```

## TSDoc — type alias

```typescript
/**
 * Псевдоним основной информации профиля.
 * @prop {string} imageUrl - Ссылка на аватар.
 * @prop {string} name - Имя Отчество Фамилия.
 * @prop {boolean} isBirthday - Сегодня день рождения?
 * @prop {boolean} isVacation - Сейчас в отпуске?
 */
type ProfileMainInfo = {
    imageUrl: string;
    name: string;
    isBirthday: boolean;
    isVacation: boolean;
};
```

## TSDoc — DTO-класс

```typescript
/**
 * DTO пользователя.
 * @extends UserShortInfoDto
 * @prop {string} objectGuid - GUID пользователя из Active Directory.
 * @prop {number} id - Идентификатор пользователя.
 * @prop {string | null} email - Адрес электронной почты.
 * @prop {Date} birthDate - Дата рождения.
 * @prop {string | null} positionName - Наименование должности.
 */
class UserDto extends UserShortInfoDto {
    public objectGuid: string = '';
    public id: number = 0;
    public email: string | null = null;
    public birthDate: Date = new Date();
    public positionName: string | null = null;
}
```

## TSDoc — generic-интерфейс

```typescript
/**
 * REST ответ от API.
 * @template TResult - Тип результата.
 * @prop {number} statusCode - Код статуса.
 * @prop {TResult | null} result - Результат.
 */
interface IRestApiResponse<TResult> {
    statusCode: number;
    result: TResult | null;
}
```

## TSDoc — синхронная и асинхронная функция

```typescript
/**
 * Возвращает текущий день и месяц в родительном падеже (января, февраля...).
 * @param {Date} date - Дата.
 * @returns {string} Строку с текущим днем и месяцем в родительном падеже.
 */
const getDayAndMonth = (date: Date): string => { /* … */ };

const getDayAndMonthAsync = async (date: Date): Promise<string> => { /* await … */ };
```

## JSDoc — класс (JS)

```javascript
/**
 * Инициализирует обработчики событий на странице.
 * @param {string} gridName - Имя грида, для которого строятся фильтры.
 * @param {Object} localization - Объект с локализованными строками.
 * @returns {void}
 */
function init(gridName, localization) {
    // Инициализация
}
```

## JSDoc — модификаторы метода (JS)

```javascript
/**
 * Инициализирует обработчики событий.
 * @private
 * @param {string} gridName - Имя грида.
 * @returns {void}
 */
function _initEvtHandlers(gridName) { /* … */ }

/**
 * Абстрактный метод загрузки данных.
 * @abstract
 * @returns {void}
 */
function loadData() { /* … */ }

/**
 * Переопределяет метод базового класса.
 * @override
 * @param {Event} event - Событие.
 * @returns {void}
 */
function handleClick(event) { /* … */ }

/**
 * Статический фабричный метод.
 * @static
 * @param {Object} params - Параметры создания.
 * @returns {InputComponent} Экземпляр компонента.
 */
static create(params) { /* … */ }
```

## JSDoc — rest-параметры и @todo

```javascript
/**
 * Возвращает сумму переданных чисел.
 * @param {number} addendum - Первое слагаемое.
 * @param {number} ...numbers - Массив остальных аргументов.
 * @returns {number} Сумму всех аргументов.
 */
function sum(addendum, ...numbers) { /* … */ }

// @todo fixme: тут не нужно использовать глобальную переменную [TASK-123]
total = 0;

// @todo: должна быть возможность изменять значение через параметр функции [TASK-456]
this.total = 0;
```

## Порядок импортов (пример)

```typescript
import { FC, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import classNames from 'classnames';

import { ProfileAvatar } from '../../molecules/ProfileAvatar/ProfileAvatar';
import { TextComponent } from '../../atoms/TextComponent/TextComponent';

import { IBirthdayPerson } from '../../../interfaces/birthday-person.interface';
import { FontWeightEnum } from '../../../enums/font-weigth.enum';
import { ProfileAvatarSize } from '../../../enums/profile-avatar-size.enum';

import { getBeforeBirthdayText } from '../../../localization/ru/birthdays/birthday.translation';
import { TODAY_TEXT } from '../../../localization/ru/dates/dates.translation';

import styles from './BirthdaysList.module.css';
```

## Деструктуризация — примеры

```typescript
// >=5 свойств — алфавитный порядок
const {
    bic,
    businessTrip,
    fio,
    id,
    notes,
    reportType,
    rs,
} = data;

// rest-синтаксис
const { title, ...rest } = options;

// Spread вместо concat
const thirdArr = [...firstArr, ...secondArr];
```

## CSS — порядок свойств (шаблон)

```css
.navComponent {
    width: 100%;
    height: 48px;
    position: relative;
    top: 0;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    box-sizing: border-box;
    border: 1px solid var(--color-secondary-200);
    margin: 0;
    padding: 0 16px;
    font-size: 14px;
    background: var(--color-primary-50);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    opacity: 1;
    visibility: visible;
    z-index: 10;
    transform: none;
    transition: background 0.2s;
    resize: none;
    user-select: none;
}

.navComponent:hover {
    background: var(--color-primary-100);
}
```

## CSS — переменные цветов

```css
:root {
    --color-primary-500: #3389f4;
    --color-primary-600: #0066cc;
    --color-primary-700: #09549d;
    --color-primary-800: #0b4482;
}

.sectionTitle {
    color: var(--color-secondary-800);
}
```

## Конфигурация ESLint (`.eslintrc.json`)

```json
{
  "env": { "browser": true, "es2021": true },
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
    "standard-with-typescript",
    "plugin:react/jsx-runtime",
    "plugin:import/recommended",
    "plugin:react-hooks/recommended",
    "plugin:eslint-comments/recommended",
    "prettier"
  ],
  "parserOptions": {
    "project": ["./tsconfig.json"],
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "plugins": ["react", "eslint-plugin-import"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "off",
    "no-unused-vars": "warn",
    "eslint-comments/require-description": "error",
    "eslint-comments/no-unlimited-disable": "off",
    "@typescript-eslint/strict-boolean-expressions": "off",
    "import/no-cycle": "warn",
    "prefer-const": "warn",
    "semi": ["warn", "always"],
    "quotes": ["error", "single"],
    "no-multi-spaces": "error",
    "import/order": [
      "warn",
      {
        "groups": ["builtin", "external", "internal", "parent", "sibling", "index", "object", "type"],
        "newlines-between": "always-and-inside-groups"
      }
    ],
    "@typescript-eslint/no-misused-promises": ["error", { "checksVoidReturn": false }]
  },
  "settings": {
    "import/resolver": { "node": { "extensions": [".js", ".jsx", ".ts", ".tsx"] } }
  }
}
```

## Конфигурация Prettier (`.prettierrc.json`)

```json
{
  "printWidth": 120,
  "useTabs": false,
  "tabWidth": 4,
  "singleQuote": true,
  "bracketSpacing": true
}
```

## Конфигурация Stylelint (`.stylelintrc.json`, ключевые правила)

```json
{
  "plugins": ["stylelint-order"],
  "rules": {
    "declaration-no-important": true,
    "no-duplicate-selectors": true,
    "color-named": "never",
    "length-zero-no-unit": true,
    "order/properties-order": [
      "width", "height",
      "position", "top", "bottom", "left", "right",
      "display", "flex-direction", "flex", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis",
      "justify-content", "justify-items", "justify-self",
      "align-content", "align-items", "align-self",
      "gap", "margin", "padding",
      "border", "border-radius", "border-color",
      "background", "background-image", "background-color",
      "box-shadow", "opacity", "visibility", "z-index",
      "transform", "transition", "resize", "user-select"
    ]
  }
}
```

Полная конфигурация Stylelint с остальными правилами — в репозитории проекта (`.stylelintrc.json`).

## Zod — схема + react-hook-form

```typescript
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const loginSchema = z.object({
    email: z.string().email('Некорректный email.'),
    password: z.string().min(8, 'Минимум 8 символов.'),
});

type LoginForm = z.infer<typeof loginSchema>;

const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
});
```

## TanStack Query — базовый паттерн

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// Запрос данных
const { data, isLoading, error } = useQuery({
    queryKey: ['users', userId],
    queryFn: () => axios.get<IUserDto>(`/api/users/${userId}`).then(r => r.data),
});

// Мутация с инвалидацией кэша
const queryClient = useQueryClient();
const { mutate } = useMutation({
    mutationFn: (dto: IUserToUpdate) => axios.put(`/api/users/${userId}`, dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
});
```

## Vite — path alias и tsconfig

`vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: { '@': path.resolve(__dirname, 'src') },
    },
});
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

## Vite runtime env — `env-config.js` (default)

`public/env-config.js`:
```javascript
window.__env__ = {
    VITE_API_BASE_URL: '/api',
};
```

`index.html`:
```html
<script src="/env-config.js"></script>
```

## Vitest — базовый тест компонента (RTL)

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { LoginForm } from '@/components/LoginForm/LoginForm';

describe('LoginForm', () => {
    it('показывает ошибку при пустом email', async () => {
        render(<LoginForm onSubmit={vi.fn()} />);
        await userEvent.click(screen.getByRole('button', { name: /войти/i }));
        expect(screen.getByText(/некорректный email/i)).toBeInTheDocument();
    });
});
```

## Постфиксы именования файлов

| Тип артефакта | Паттерн файла |
|---|---|
| Интерфейс | `kebab-name.interface.ts` |
| Пропсы компонента | `kebab-name.props.ts` |
| Enum | `kebab-name.enum.ts` |
| Type alias | `kebab-name.type.ts` |
| DTO / серверная модель | `kebab-name.dto.ts` |
| Модель данных (класс) | `kebab-name.models.ts` |
| Хелпер | `kebab-name.helper.ts` |
| CSS Module | `ComponentName.module.css` |
