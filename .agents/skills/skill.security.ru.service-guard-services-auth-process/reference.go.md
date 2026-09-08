# Reference: Go

Пример самодостаточен: стандартная библиотека + указанные публичные пакеты. Без зависимостей от внутренних корпоративных библиотек.

Зависимости:

```
golang.org/x/oauth2              // Consumer: clientcredentials + кэш токена
github.com/gin-gonic/gin         // Provider: HTTP-фреймворк
github.com/golang-jwt/jwt/v5     // Provider: разбор/валидация JWT
github.com/MicahParks/keyfunc/v3 // Provider: загрузка и ротация JWKS
```

Конфигурация читается из файла в типизированную модель, а не из переменных окружения. Секрет клиента подставляется из защищённого источника (секрет-менеджер / защищённая конфигурация развёртывания) и не хранится в репозитории.

## Модель конфигурации

```go
package serviceguard

import (
	"encoding/json"
	"os"
)

// ServiceGuardConfig — конфигурация доступа к Service-Guard.
type ServiceGuardConfig struct {
	BaseURL          string `json:"baseUrl"`          // базовый URL Service-Guard
	Realm            string `json:"realm"`            // realm Service-Guard, зависит от окружения (test/prod), обычно systems
	ClientID         string `json:"clientId"`         // client_id (Consumer)
	ClientSecret     string `json:"clientSecret"`     // из защищённого источника, не из репозитория
	ProviderClientID string `json:"providerClientId"` // свой client_id (Provider)
}

// LoadConfig читает конфигурацию из JSON-файла в типизированную модель.
func LoadConfig(path string) (ServiceGuardConfig, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return ServiceGuardConfig{}, err
	}
	var serviceGuardConfig ServiceGuardConfig
	if err := json.Unmarshal(content, &serviceGuardConfig); err != nil {
		return ServiceGuardConfig{}, err
	}
	return serviceGuardConfig, nil
}
```

## Consumer

`clientcredentials.Config.Client` возвращает `*http.Client`, который сам получает токен, **кэширует** его, обновляет по истечении и добавляет заголовок `Authorization: Bearer` к каждому запросу.

```go
package serviceguard

import (
	"context"
	"net/http"

	"golang.org/x/oauth2/clientcredentials"
)

// NewHTTPClient — http.Client с автоматическим client_credentials-токеном.
func NewHTTPClient(ctx context.Context, serviceGuardConfig ServiceGuardConfig) *http.Client {
	clientCredentials := clientcredentials.Config{
		ClientID:     serviceGuardConfig.ClientID,
		ClientSecret: serviceGuardConfig.ClientSecret,
		TokenURL:     serviceGuardConfig.BaseURL + "/realms/" + serviceGuardConfig.Realm + "/protocol/openid-connect/token",
	}
	return clientCredentials.Client(ctx) // TokenSource кэширует и обновляет токен
}

// GetEmployees — пример основного запроса (Authorization добавляется автоматически).
func GetEmployees(ctx context.Context, httpClient *http.Client, providerURL string) (*http.Response, error) {
	return httpClient.Get(providerURL + "/api/v1/employees")
}
```

## Provider (Gin)

Middleware валидирует подпись по JWKS, `iss`, `exp` и проверяет роль в `resource_access.<свой-client_id>.roles`.

```go
package serviceguard

import (
	"net/http"
	"strings"
	"time"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// clockSkewLeeway — допустимый рассинхрон часов при валидации exp.
const clockSkewLeeway = 30 * time.Second

// serviceGuardClaims — клеймы токена Service-Guard, нужные для авторизации.
type serviceGuardClaims struct {
	ResourceAccess map[string]struct {
		Roles []string `json:"roles"`
	} `json:"resource_access"`
	jwt.RegisteredClaims
}

// RequireRole — middleware: валидирует токен и проверяет роль в resource_access.
func RequireRole(jwks keyfunc.Keyfunc, issuer, providerClientID, requiredRole string) gin.HandlerFunc {
	return func(ginContext *gin.Context) {
		authorizationHeader := ginContext.GetHeader("Authorization")
		if !strings.HasPrefix(authorizationHeader, "Bearer ") {
			ginContext.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
			return
		}
		claims := &serviceGuardClaims{}
		token, err := jwt.ParseWithClaims(strings.TrimPrefix(authorizationHeader, "Bearer "), claims, jwks.Keyfunc,
			jwt.WithIssuer(issuer),
			jwt.WithValidMethods([]string{"RS256"}),
			jwt.WithLeeway(clockSkewLeeway),
		)
		if err != nil || !token.Valid {
			ginContext.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		if !hasRole(claims, providerClientID, requiredRole) {
			ginContext.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "missing role: " + requiredRole})
			return
		}
		ginContext.Next()
	}
}

func hasRole(claims *serviceGuardClaims, providerClientID, requiredRole string) bool {
	for _, grantedRole := range claims.ResourceAccess[providerClientID].Roles {
		if grantedRole == requiredRole {
			return true
		}
	}
	return false
}

// SetupRouter — пример сборки роутера с защищённым эндпоинтом.
func SetupRouter(serviceGuardConfig ServiceGuardConfig) (*gin.Engine, error) {
	jwks, err := keyfunc.NewDefault([]string{serviceGuardConfig.BaseURL + "/realms/" + serviceGuardConfig.Realm + "/protocol/openid-connect/certs"})
	if err != nil {
		return nil, err // не удалось загрузить JWKS
	}
	issuer := serviceGuardConfig.BaseURL + "/realms/" + serviceGuardConfig.Realm

	router := gin.Default()
	router.GET("/api/v1/employees",
		RequireRole(jwks, issuer, serviceGuardConfig.ProviderClientID, "users"),
		func(ginContext *gin.Context) {
			ginContext.JSON(http.StatusOK, gin.H{"data": []string{}})
		})
	return router, nil
}
```

Примечания:
- `keyfunc.NewDefault` сам периодически обновляет JWKS (ротация ключей по `kid`).
- `401` — невалидный/отсутствующий токен; `403` — нет роли.

Поля и протокол — [reference.protocol.md](reference.protocol.md).
