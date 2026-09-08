# reference.md — skill.integration.ru.openapi-specs

## 1) Структура файлов: один сервис vs несколько сервисов

- Один сервис -> один OpenAPI-контракт (`openapi.<service-name>.md` или `.yaml` при инструментальной необходимости).
- Несколько сервисов (монорепозиторий) -> отдельный контракт на каждый сервис.
- Внешние интеграции документируй отдельными файлами `openapi.external.<service-name>.*`.

## 2) Минимальный рабочий пример OpenAPI 3.0.3

```yaml
openapi: 3.0.3
info:
  title: Orders API
  version: 1.2.0
  description: REST API for orders and customers.
servers:
  - url: https://api.example.com
    description: Production
  - url: https://staging-api.example.com
    description: Staging
tags:
  - name: users
  - name: orders
security:
  - bearerAuth: []
paths:
  /v1/users/{userId}:
    get:
      tags: [users]
      summary: Get user by id
      operationId: getUserById
      security:
        - bearerAuth: []
      parameters:
        - in: path
          name: userId
          required: true
          schema:
            type: string
      responses:
        '200':
          description: User details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
              example:
                id: "u-1001"
                email: user@example.com
        '404':
          description: User not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProblemDetails'
  /v1/orders:
    post:
      tags: [orders]
      summary: Create order
      operationId: createOrder
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateOrderRequest'
            example:
              customerId: "c-101"
              items:
                - sku: "sku-1"
                  quantity: 2
      responses:
        '201':
          description: Order created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/OrderCreatedResponse'
              example:
                orderId: "o-9001"
                status: "created"
        '400':
          description: Validation failed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProblemDetails'
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    User:
      type: object
      required: [id, email]
      properties:
        id:
          type: string
          description: User identifier.
        email:
          type: string
          format: email
          description: User email.
    CreateOrderRequest:
      type: object
      required: [customerId, items]
      properties:
        customerId:
          type: string
        items:
          type: array
          minItems: 1
          items:
            $ref: '#/components/schemas/CreateOrderItem'
    CreateOrderItem:
      type: object
      required: [sku, quantity]
      properties:
        sku:
          type: string
        quantity:
          type: integer
          minimum: 1
    OrderCreatedResponse:
      type: object
      required: [orderId, status]
      properties:
        orderId:
          type: string
        status:
          type: string
          enum: [created]
    ProblemDetails:
      type: object
      required: [type, title, status]
      properties:
        type:
          type: string
          format: uri
        title:
          type: string
        status:
          type: integer
        detail:
          type: string
        instance:
          type: string
```

## 3) Конвенция `operationId`

- Используй шаблон `<httpMethod><Resource>` в camelCase.
- Примеры:
  - `getUserById`
  - `createOrder`
  - `updateOrderStatus`
  - `deleteOrderById`

## 4) Политика `$ref` и inline-схем

- Переиспользуемые структуры и сложные модели (вложенные объекты, массивы объектов, polymorphism) выноси в `components/schemas`.
- Inline-схемы оставляй только для тривиальных локальных случаев (например, одно простое поле, используемое в одном месте).

## 5) Security-by-default

- Глобально задай `security` для защищенного API.
- Для публичных endpoint укажи `security: []` явно, чтобы исключение было декларативным и проверяемым.

## 6) Deprecation-стратегия

- Для устаревающих операций и схем используй `deprecated: true`.
- В `description` укажи рекомендуемую замену и, при наличии, срок вывода.

## 7) Automation hooks (lint/validate)

- Lint: Spectral (`spectral lint <file>`).
- Validate: `swagger-cli validate <file>`.
- Дополнительно для codegen-пайплайнов: `openapi-generator validate -i <file>`.
