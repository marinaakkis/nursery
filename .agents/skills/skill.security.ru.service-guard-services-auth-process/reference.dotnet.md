# Reference: .NET (ASP.NET Core)

Пример самодостаточен: только стандартные пакеты ASP.NET Core.

Зависимости: `Microsoft.AspNetCore.Authentication.JwtBearer` (Provider); `Microsoft.Extensions.Http` (Consumer, входит в ASP.NET Core).

Конфигурация читается из типизированной модели опций (`IOptions<ServiceGuardOptions>`), привязанной к секции `ServiceGuard` конфигурации, а не из переменных окружения напрямую. Секрет (`ClientSecret`) подставляется из защищённого источника (User Secrets / Key Vault / защищённая конфигурация развёртывания) и **не** хранится в `appsettings.json` репозитория.

## Модель опций и конфигурация

```csharp
public sealed class ServiceGuardOptions
{
    public string BaseUrl { get; init; } = "";
    public string Realm { get; init; } = "systems"; // зависит от окружения (test/prod)
    public string ClientId { get; init; } = "";
    public string ClientSecret { get; init; } = ""; // из защищённого источника, не из appsettings в репозитории
    public string ProviderClientId { get; init; } = "";
}
```

`appsettings.json` (без секрета; `Realm` зависит от окружения test/prod, пример — `systems`):

```json
{
  "ServiceGuard": {
    "BaseUrl": "https://<service-guard-host-test>",
    "Realm": "<service-guard-env-realm>",
    "ClientId": "<consumer>-service",
    "ProviderClientId": "provider-service"
  }
}
```

Привязка модели:

```csharp
builder.Services.Configure<ServiceGuardOptions>(builder.Configuration.GetSection("ServiceGuard"));
```

## Consumer (`IHttpClientFactory` + `DelegatingHandler`)

`DelegatingHandler` получает токен, кэширует его до `expires_in` (с буфером) и добавляет заголовок `Authorization` к исходящим запросам.

```csharp
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

public sealed class ServiceGuardTokenHandler : DelegatingHandler
{
    private const int TokenExpiryBufferSeconds = 60; // запас до фактического истечения (сеть + рассинхрон часов)

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ServiceGuardOptions _options;
    private readonly SemaphoreSlim _lock = new(1, 1);
    private string? _accessToken;
    private DateTimeOffset _expiresAt;

    public ServiceGuardTokenHandler(IHttpClientFactory httpClientFactory, IOptions<ServiceGuardOptions> options)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
    }

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", await GetTokenAsync(cancellationToken));
        return await base.SendAsync(request, cancellationToken);
    }

    private async Task<string> GetTokenAsync(CancellationToken cancellationToken)
    {
        if (_accessToken is not null && DateTimeOffset.UtcNow < _expiresAt) return _accessToken;
        await _lock.WaitAsync(cancellationToken);
        try
        {
            if (_accessToken is not null && DateTimeOffset.UtcNow < _expiresAt) return _accessToken;

            using HttpClient httpClient = _httpClientFactory.CreateClient("service-guard-token");
            using FormUrlEncodedContent form = new(new Dictionary<string, string>
            {
                ["grant_type"] = "client_credentials",
                ["client_id"] = _options.ClientId,
                ["client_secret"] = _options.ClientSecret,
            });
            using HttpResponseMessage response = await httpClient.PostAsync(
                $"{_options.BaseUrl}/realms/{_options.Realm}/protocol/openid-connect/token", form, cancellationToken);
            response.EnsureSuccessStatusCode();

            TokenResponse? tokenResponse = await response.Content.ReadFromJsonAsync<TokenResponse>(cancellationToken);
            _accessToken = tokenResponse!.AccessToken;
            _expiresAt = DateTimeOffset.UtcNow.AddSeconds(tokenResponse.ExpiresIn - TokenExpiryBufferSeconds);
            return _accessToken;
        }
        finally
        {
            _lock.Release();
        }
    }

    private sealed record TokenResponse(
        [property: JsonPropertyName("access_token")] string AccessToken,
        [property: JsonPropertyName("expires_in")] int ExpiresIn);
}
```

Регистрация типизированного клиента:

```csharp
builder.Services.AddHttpClient("service-guard-token");
builder.Services.AddTransient<ServiceGuardTokenHandler>();
builder.Services.AddHttpClient("provider", client => client.BaseAddress = new Uri("https://<provider-host>"))
    .AddHttpMessageHandler<ServiceGuardTokenHandler>(); // токен добавляется автоматически
```

## Provider (ASP.NET Core, `JwtBearer`)

```csharp
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<ServiceGuardOptions>(builder.Configuration.GetSection("ServiceGuard"));
ServiceGuardOptions serviceGuardOptions =
    builder.Configuration.GetSection("ServiceGuard").Get<ServiceGuardOptions>()!;

const int ClockSkewSeconds = 30; // допустимый рассинхрон часов при проверке exp

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = $"{serviceGuardOptions.BaseUrl}/realms/{serviceGuardOptions.Realm}"; // metadata + JWKS подтянутся автоматически
        options.RequireHttpsMetadata = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = $"{serviceGuardOptions.BaseUrl}/realms/{serviceGuardOptions.Realm}",
            ValidateAudience = false, // s2s: авторизуем по resource_access, не по aud
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(ClockSkewSeconds),
        };
    });

builder.Services.AddAuthorization(options =>
    options.AddPolicy("users", policy => policy.RequireAssertion(authorizationContext =>
        HasResourceRole(authorizationContext.User, serviceGuardOptions.ProviderClientId, "users"))));

var app = builder.Build();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/api/v1/employees", () => Results.Ok(Array.Empty<string>()))
   .RequireAuthorization("users");

app.Run();

// resource_access приходит как JSON-строка в одноимённом клейме.
static bool HasResourceRole(ClaimsPrincipal user, string providerClientId, string requiredRole)
{
    string? resourceAccessClaim = user.FindFirst("resource_access")?.Value;
    if (string.IsNullOrEmpty(resourceAccessClaim)) return false;

    using JsonDocument clientAccessSettings = JsonDocument.Parse(resourceAccessClaim);
    return clientAccessSettings.RootElement.TryGetProperty(providerClientId, out JsonElement providerAccess)
        && providerAccess.TryGetProperty("roles", out JsonElement roles)
        && roles.EnumerateArray().Any(roleElement => roleElement.GetString() == requiredRole);
}
```

Примечания:
- Отсутствие/невалидность токена → `401` (JwtBearer); провал политики `users` → `403`.
- `Authority` сам кэширует OIDC-метаданные и JWKS с периодическим обновлением.

Поля и протокол — [reference.protocol.md](reference.protocol.md).
