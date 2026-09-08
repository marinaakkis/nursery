# Reference: terragrunt.hcl (описание клиента Service-Guard)

Файл создаётся в каталоге клиента в ветке окружения (`test`/`stage`/`master`):
`<gitlab-host>/iac/<systems-root>/<system-group>/<system-serviceguard-project>/<system-service-client>/terragrunt.hcl`

Секрет и URL Keycloak — **только через переменные окружения** (`get_env`); не хардкодить.

## Полный пример

```hcl
inputs = {
  # Подключение к Keycloak — только из окружения CI:
  kk_main_secret = get_env("kk_main_secret")
  kk_url         = get_env("kk_url")

  client_id   = "ClientC"
  client_name = "ClientC"

  # Роли клиента ClientC (ключ — имя роли, значение — описание):
  roles = {
    "Role1" = "Description for Role1"
    "Role2" = "Description for Role2"
    "Role3" = "Description for Role3"
  }

  # Кто получает доступ к ролям ClientC
  # (роль -> клиенты, чьи сервисные аккаунты добавляются в группу роли):
  client_system_access = {
    "Role2" = ["ClientA"]
    "Role1" = ["ClientB", "ClientA"]
  }
}
```

## Справочник входов

| Вход | Тип | Назначение |
|---|---|---|
| `kk_main_secret` | string (env) | Секрет клиента для подключения к Keycloak. Только `get_env`. |
| `kk_url` | string (env) | URL инстанса Keycloak. Только `get_env`. |
| `client_id` | string | Уникальный идентификатор клиента в Keycloak |
| `client_name` | string | Человекочитаемое имя клиента |
| `roles` | map(string→string) | Роли клиента: ключ — имя роли, значение — описание |
| `client_system_access` | map(string→list) | Роль → список клиентов, чьи сервисные аккаунты добавляются в группу роли |

## Что создаёт пример

- **Роли** на клиенте `ClientC`: `Role1`, `Role2`, `Role3`.
- **Группы** (по одной на роль): `ClientC.Role1-group`, `ClientC.Role2-group`, `ClientC.Role3-group`.
- **Членства** (по `client_system_access`):
  - в `ClientC.Role2-group` добавляется сервисный аккаунт `ClientA`;
  - в `ClientC.Role1-group` добавляются сервисные аккаунты `ClientB` и `ClientA`.

## Как это проявится в токене (связь с runtime)

Когда `ClientA` запросит токен по `client_credentials`, он состоит в `ClientC.Role1-group` и `ClientC.Role2-group`, поэтому в его JWT будет:

```json
"resource_access": {
  "ClientC": { "roles": ["Role1", "Role2"] }
}
```

`ClientC` (Provider) при входящем запросе от `ClientA` проверит наличие нужной роли в `resource_access["ClientC"].roles`. Проверка ролей на стороне Provider — в скилле `service-guard-services-auth-process`.
