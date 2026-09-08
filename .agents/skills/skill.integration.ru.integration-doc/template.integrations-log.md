# Integration Log Template

Технический шаблон журнала интеграций для git-хуков `pre-commit` и `pre-push`.

> Создавай файл как: `docs/integrations/integrations-log.{project-name}.md`

## Назначение

- Журнал активирует проверку паспортов интеграций.
- Проверки выполняются только по строкам, где `Deleted At UTC` пустой.
- Если `Deleted At UTC` заполнен, интеграция считается удаленной, но паспорт сохраняется.

## Формат

| Integration ID | Name | Stack | Scope | Added At UTC | Last Changed At UTC | Deleted At UTC | Code Marker | Passport Path |
|---|---|---|---|---|---|---|---|---|
<!-- | payment-gateway | Payment Gateway | REST | external | 2025-01-15T10:00:00Z | 2025-06-01T08:00:00Z | | Payment Gateway | integration-passport.payment-gateway.md | -->

## Типы и правила полей

| Поле | Тип | Обязательность | Формат/правило |
|---|---|---|---|
| `Integration ID` | `string` | да | `kebab-case`, regex `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `Name` | `string` | да | Человекочитаемое имя интеграции; автозаполняется из `markerLabel` детектора |
| `Stack` | `string` | да | Технология/протокол: `REST`, `gRPC`, `Kafka`, `PostgreSQL`, `Redis` и т.п.; автозаполняется из детектора |
| `Scope` | `enum` | **да** | `external` — за периметром системы, паспорт обязателен; `internal` — внутри системы, паспорт не нужен |
| `Added At UTC` | `datetime` | да | RFC3339 UTC: `YYYY-MM-DDTHH:mm:ssZ` |
| `Last Changed At UTC` | `datetime` | да | RFC3339 UTC: `YYYY-MM-DDTHH:mm:ssZ`; обновляется при: (1) возврате после удаления, (2) изменении `codeMarker`, (3) невалидном предыдущем значении |
| `Deleted At UTC` | `datetime?` | нет | пусто для active, иначе RFC3339 UTC |
| `Code Marker` | `string` | да | стабильная метка типа интеграции (без файловых путей); автозаполняется из `markerLabel` |
| `Passport Path` | `string` | да | путь к паспорту относительно `docs/integrations/`, например `integration-passport.openai-compatible-llm.md` |

## Вычисляемые правила хуков

- `active` интеграция: `Deleted At UTC` пустой.
- `deleted` интеграция: `Deleted At UTC` заполнен.
- `Passport Exists` и `Hook Validation` в файл журнала не записываются: они вычисляются хуками во время проверки.
