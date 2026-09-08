# FastAPI + React — Keycloak Auth Skill

AI-скилл для добавления аутентификации через Keycloak (OIDC) в проекты на **FastAPI + React + Vite**.

Агент следует структурированному многофазному процессу: приводит проект к целевой архитектуре, валидирует стек, реализует бэкенд и фронтенд auth-код, а затем проверяет результат по 37 известным ошибкам.

## Что делает

Реализует **OAuth2 Authorization Code flow** от начала до конца:

1. Keycloak отвечает за UI логина
2. FastAPI обменивает authorization code на токены и выпускает собственный JWT в httpOnly cookie
3. React читает состояние аутентификации через `/api/auth/me`
4. Sliding session middleware обновляет JWT при каждом успешном запросе

## Поток аутентификации

```
Browser GET /api/auth/login
  -> FastAPI генерирует state, ставит state cookie, редиректит на Keycloak
  -> Пользователь аутентифицируется в Keycloak
  -> Keycloak редиректит на /api/auth/callback?code=...&state=...
  -> FastAPI валидирует state, обменивает code на access_token
  -> FastAPI запрашивает userinfo у Keycloak
  -> FastAPI создает собственный JWT, ставит auth_token cookie
  -> FastAPI редиректит на URL фронтенда
  -> React вызывает GET /api/auth/me для получения данных пользователя из JWT
```

## Структура скилла

```
fastapi-react/
  README.md                   # Этот файл
  SKILL.md                    # Главный файл: архитектура, переменные окружения,
                              # правила безопасности, чеклист, 19 типичных ошибок
  phases/
    00-refactor.md            # Фаза 0: рефакторинг к целевой архитектуре
    01-validate.md            # Фаза 1: валидация стека, зависимостей, Keycloak
    02-backend.md             # Фаза 2a: бэкенд auth (шаги 2.1-2.9)
    02-frontend.md            # Фаза 2b: фронтенд auth (шаги 2.10-2.16)
    02-infra.md               # Фаза 2c: инфраструктура (шаг 2.17)
    03-review.md              # Фаза 3: ревью по чеклистам (37 ошибок)
```

## Целевая архитектура проекта

Скилл приводит проект к этой структуре перед интеграцией auth:

```
project-root/
  docker-compose.yml          # 2 сервиса: backend + frontend (nginx встроен)
  .env.template               # Все переменные окружения с описаниями
  backend/
    Dockerfile                # Python, WORKDIR /app
    requirements.txt
    app/
      main.py                 # Точка входа FastAPI
      config.py               # Pydantic BaseSettings
      auth/                   # Auth-пакет (создается скиллом)
        __init__.py
        keycloak.py           # OIDC discovery, обмен кода, userinfo
        jwt_utils.py          # Создание/декодирование JWT
        dependencies.py       # get_current_user dependency
        router.py             # /login, /callback, /me, /logout
        middleware.py          # Sliding session middleware
      routers/                # Роутеры бизнес-логики
  frontend/
    Dockerfile                # Multi-stage: node build + nginx serve
    nginx/
      nginx.conf              # Базовый nginx конфиг (буферы)
      generate-conf.sh        # Генерирует server block из BASE_PATH
    app/
      src/
        config.js             # BASE_PATH, API_BASE_URL, LOGIN_URL
        api.js                # Axios клиент с 401 interceptor
        store/authStore.js    # Zustand auth store
        components/ProtectedRoute.jsx
        pages/LoginPage.jsx
```

## Использование

После установки (см. [корневой README](../README.md)) попросите AI-агента:

- "Добавь аутентификацию через Keycloak в этот проект"
- "Реализуй OAuth/OIDC логин через Keycloak"
- "Настрой корпоративный SSO для этого FastAPI + React приложения"
- "Проверь реализацию аутентификации"

Агент выполнит:

1. **Фаза 0** — анализ и рефакторинг проекта к целевой архитектуре (2 Docker-сервиса, встроенный nginx, правильный стиль импортов)
2. **Фаза 1** — валидация стека, проверка зависимостей, готовность Keycloak
3. **Фаза 2** — реализация auth от начала до конца (конфиг бэкенда, OIDC-клиент, JWT-утилиты, auth-роутер, middleware, фронтенд store, защищенные роуты, страница логина)
4. **Фаза 3** — ревью по 37 известным ошибкам и чеклистам

## Требования

### Бэкенд

- Python 3.10+
- FastAPI >= 0.100
- pydantic-settings
- httpx
- python-jose[cryptography]

### Фронтенд

- React >= 18
- react-router-dom >= 6
- axios >= 1
- zustand >= 4
- Vite

### Инфраструктура

- Docker + Docker Compose
- Инстанс Keycloak с настроенным realm и client

## Ключевые архитектурные решения

- **httpOnly cookies** — JWT хранится в httpOnly cookie, а не в localStorage. Защищает от кражи токена через XSS.
- **Собственный JWT** — FastAPI выпускает свой JWT вместо передачи токенов Keycloak на фронтенд. Отвязывает управление сессиями от IdP.
- **Sliding sessions** — middleware обновляет JWT при каждом успешном запросе, поэтому сессия истекает через N минут *бездействия*, а не через N минут после логина.
- **2-сервисная Docker-архитектура** — nginx встроен в контейнер фронтенда. Бэкенд доступен только через nginx. Упрощает деплой и сетевое взаимодействие.
- **Динамический nginx-конфиг** — `generate-conf.sh` генерирует server block из `BASE_PATH` при старте контейнера. Не нужно вручную править nginx при деплое на разных subpath.

## Переменные окружения

| Переменная | Назначение |
|------------|-----------|
| `KEYCLOAK_DISCOVERY_URL` | URL OIDC discovery endpoint Keycloak. FastAPI загружает auth-эндпоинты отсюда при старте. |
| `KEYCLOAK_CLIENT_ID` | Идентификатор приложения в Keycloak. |
| `KEYCLOAK_CLIENT_SECRET` | Секрет клиента для обмена authorization code на токены. |
| `JWT_SECRET` | Случайная строка (мин. 32 символа) для подписи JWT сессий. Генерация: `openssl rand -base64 32`. |
| `JWT_EXPIRE_MINUTES` | Таймаут сессии в минутах бездействия. По умолчанию: 60. |
| `BASE_PATH` | URL-префикс приложения (например `/my-app/`). Должен заканчиваться на `/`. |
| `EXTERNAL_HOST` | Полный публичный URL, который пользователи набирают в браузере. |
| `COOKIE_SECURE` | `true` для HTTPS, `false` для локальной HTTP-разработки. |

Подробное описание каждой переменной — в `SKILL.md`, раздел "Environment Variables Explained".
