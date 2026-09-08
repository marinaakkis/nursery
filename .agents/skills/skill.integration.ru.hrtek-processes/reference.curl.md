# Reference: базовый процесс на curl

Сквозной сценарий через шлюз `bcd-to-hrtek`, разбитый на подпроцессы. Плейсхолдеры — единый набор (см. [SKILL.md](SKILL.md)). Реальные секреты/PII не подставлять. Детали авторизации — [reference.auth.md](reference.auth.md); процессы — [reference.flows.md](reference.flows.md).

Каждый шаг оформлен единообразно: **Запрос** (curl) → **Обработка ответа** (что берём из ответа для следующего шага). Переменные окружения сохраняют идентификаторы между шагами.

---

## Подпроцесс 0. Подготовка: токен Service-Guard

**Запрос:**
```bash
ACCESS_TOKEN=$(curl -sS -X POST \
  "https://<service-guard-host>/realms/<service-guard-env-realm>/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=<consumer-client-id>" \
  -d "client_secret=$SG_CLIENT_SECRET" | jq -r .access_token)
```
**Обработка ответа:** из JSON берём `access_token` в переменную `ACCESS_TOKEN`; используем как `Authorization: Bearer` во всех последующих запросах. `SG_CLIENT_SECRET`, хост и realm — из окружения, не хардкодить.

---

## Подпроцесс A. Запуск электронного подписания

### Шаг A1. Резолв пользователя в идентификатор VK HR Tek

**Запрос (вариант по СНИЛС):**
```bash
USER_ID=$(curl -sS "https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0/user/by_snils?snils=123-456-789%2000" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Accept: application/json" | jq -r .id)
```

**Запрос (вариант по табельному номеру):**
```bash
USER_ID=$(curl -sS "https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0/user/by_personnel_number?personnel_number=00000001&company_id=<company-id>" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Accept: application/json" | jq -r .id)
```
**Обработка ответа:** из JSON берём `id` в переменную `USER_ID`; далее передаём его в заголовке `X-User-Id`.

### Шаг A2. Получение сотрудника

**Запрос:**
```bash
EMPLOYEE_ID=$(curl -sS "https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0/user" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "X-User-Id: $USER_ID" -H "Accept: application/json" \
  | jq -r '.employees[0].id')
```
**Обработка ответа:** из `employees[0].id` берём идентификатор сотрудника в `EMPLOYEE_ID` (используется как `employee_id` при создании Заявки); при необходимости берём `employees[0].company.legal_id` как `company_id`.

### Шаг A3. Создание Заявки

**Запрос:**
```bash
EVENT_ID=$(curl -sS -X POST "https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0/event" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "X-User-Id: $USER_ID" -H "X-Side: company" \
  -H "Content-Type: application/json" \
  -d '{ "event_type_id": "<event-type-id>", "employee_id": "'"$EMPLOYEE_ID"'" }' | jq -r .event_id)
```
**Обработка ответа:** из `event_id` берём идентификатор Заявки в `EVENT_ID` — это корреляционный ключ всех дальнейших шагов. `<event-type-id>` берётся из `GET /event/create_options` (поле `options[].event_type_id` нужного типа Заявки).

### Шаг A4. Поиск активного этапа загрузки

**Запрос:**
```bash
NODE_ID=$(curl -sS "https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0/event/$EVENT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "X-User-Id: $USER_ID" -H "X-Side: company" \
  | jq -r '.active_nodes[] | select(.action.type == "upload") | .node_id')
```
**Обработка ответа:** выбираем элемент `active_nodes[]` с `action.type == "upload"` (ожидается загрузка документа) и берём его `node_id` в `NODE_ID`.

### Шаг A5. Загрузка документа

**Запрос:**
```bash
curl -sS -X POST "https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0/event/$EVENT_ID/$NODE_ID/upload" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "X-User-Id: $USER_ID" -H "X-Side: company" \
  -F "document=@/path/to/document.pdf"
  # Атрибуты этапа (по form_attributes) — отдельными полями attributes[<uuid>]:
  #   -F 'attributes[<attribute-uuid>]=значение'        (type=text)
  #   -F 'attributes[<attribute-uuid>]=@/path/attr.pdf' (type=file)
```
**Обработка ответа:** ожидаем `200` без тела. Перечень требуемых атрибутов — из `nodes[].actions[].form_attributes` (`GET /event/$EVENT_ID`); если их нет — поля `attributes[...]` не передаются. Признак продвижения — повторный `GET /event/$EVENT_ID` больше не содержит активного `upload`-этапа (см. подпроцесс B).

---

## Подпроцесс B. Контроль статуса и получение подписанного файла

### Шаг B1. Поллинг статуса до завершения

**Запрос:**
```bash
while :; do
  ACTION_TYPE=$(curl -sS "https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0/event/$EVENT_ID" \
    -H "Authorization: Bearer $ACCESS_TOKEN" -H "X-User-Id: $USER_ID" -H "X-Side: company" \
    | jq -r '.active_nodes[0].action.type')
  [ "$ACTION_TYPE" = "completed" ] && break
  sleep 15
done
```
**Обработка ответа:** повторяем запрос с интервалом, пока `active_nodes[].action.type` не станет `completed`. Затем отдельным запросом берём `document_id` из `documents[0].id`. Вебхуков нет — только поллинг.

### Шаг B2. Скачивание подписанного PDF

**Запрос:**
```bash
curl -sS "https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0/event/$EVENT_ID/document/$DOCUMENT_ID/file_with_stamp" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "X-User-Id: $USER_ID" -H "X-Side: company" \
  -H "Accept: application/pdf" -o signed.pdf
```
**Обработка ответа:** тело ответа — двоичные данные PDF (`application/pdf`); сохраняем в файл `signed.pdf`.

---

## Подпроцесс C. Отмена Заявки

### Шаг C1. Отмена

**Запрос:**
```bash
curl -sS -i -X POST "https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0/event/$EVENT_ID/cancel" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "X-User-Id: $USER_ID" -H "X-Side: company" \
  -H "Content-Type: application/json" -d '{ "reason_id": 4 }'
```
**Обработка ответа:** для незавершённой Заявки — `200` с `{ event_id }` (состояние `canceled`); для уже завершённой — `403` с `error_code = forbidden`. Допустимость отмены можно заранее проверить по `permissions.cancel` из `GET /event/$EVENT_ID`.
