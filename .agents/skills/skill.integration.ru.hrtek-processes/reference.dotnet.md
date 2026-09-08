# Reference: базовый процесс на .NET (C#)

Максимально полный пример реализации базового процесса VK HR Tek через шлюз `bcd-to-hrtek` на .NET (8/10). Код следует `skill.dev.ru.dotnet-csharp-standards` и `skill.dev.ru.coding-standards-universal`: полные имена без сокращений, явные типы там, где тип неочевиден справа, именованные константы вместо «магических» значений, Allman-скобки, `ConfigureAwait(false)` в библиотечном коде, `CancellationToken` последним параметром. Секреты — из конфигурации/секрет-менеджера; хосты/realm — из конфигурации окружения. Детали токена — [reference.auth.md](reference.auth.md); процессы — [reference.flows.md](reference.flows.md).

## 1. Конфигурация (типизированная)

```csharp
public sealed class EsbKrakendConnectionOptions
{
    /// <summary>База шлюза, например https://&lt;esb-krakend-host&gt;/bcd-to-hrtek/api/v1.0</summary>
    public string GatewayBaseUrl { get; init; } = default!;

    /// <summary>URL получения токена Service-Guard; хост и realm зависят от окружения.</summary>
    public string ServiceGuardTokenUrl { get; init; } = default!;

    public string ClientId { get; init; } = default!;

    /// <summary>Из секрет-менеджера / переменных окружения — не из файла в git.</summary>
    public string ClientSecret { get; init; } = default!;

    /// <summary>Сторона взаимодействия: "employee" или "company".</summary>
    public string Side { get; init; } = "company";

    public int RequestTimeoutSeconds { get; init; } = 30;
}
```

```jsonc
// appsettings.json. ClientSecret — из env/secret manager, не из файла в git.
// Хост и realm в ServiceGuardTokenUrl зависят от окружения (test/prod).
"EsbKrakend": {
  "GatewayBaseUrl": "https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0",
  "ServiceGuardTokenUrl": "https://<service-guard-host>/realms/<service-guard-env-realm>/protocol/openid-connect/token",
  "ClientId": "<consumer-client-id>",
  "Side": "company",
  "RequestTimeoutSeconds": 30
}
```

## 2. Токен Service-Guard: кэширование + DelegatingHandler

```csharp
public sealed class ServiceGuardTokenProvider
{
    private const int TokenExpiryBufferSeconds = 60;

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly EsbKrakendConnectionOptions _options;
    private readonly SemaphoreSlim _tokenSemaphore = new(initialCount: 1, maxCount: 1);

    private string? _accessToken;
    private DateTimeOffset _accessTokenExpiresAt;

    public ServiceGuardTokenProvider(IHttpClientFactory httpClientFactory, IOptions<EsbKrakendConnectionOptions> options)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
    }

    public async Task<string> GetAccessTokenAsync(bool forceRefresh, CancellationToken cancellationToken)
    {
        if (!forceRefresh && IsTokenValid())
        {
            return _accessToken!;
        }

        await _tokenSemaphore.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (!forceRefresh && IsTokenValid())
            {
                return _accessToken!;
            }

            HttpClient httpClient = _httpClientFactory.CreateClient(HrTekHttpClientNames.ServiceGuard);
            FormUrlEncodedContent requestContent = new(new Dictionary<string, string>
            {
                ["grant_type"] = "client_credentials",
                ["client_id"] = _options.ClientId,
                ["client_secret"] = _options.ClientSecret,
            });

            using HttpResponseMessage response = await httpClient
                .PostAsync(_options.ServiceGuardTokenUrl, requestContent, cancellationToken)
                .ConfigureAwait(false);
            response.EnsureSuccessStatusCode();

            ServiceGuardTokenResponse tokenResponse = await response.Content
                .ReadFromJsonAsync<ServiceGuardTokenResponse>(cancellationToken)
                .ConfigureAwait(false)
                ?? throw new InvalidOperationException("Service-Guard вернул пустой ответ токена.");

            _accessToken = tokenResponse.AccessToken;
            _accessTokenExpiresAt = DateTimeOffset.UtcNow
                .AddSeconds(tokenResponse.ExpiresInSeconds - TokenExpiryBufferSeconds);
            return _accessToken;
        }
        finally
        {
            _tokenSemaphore.Release();
        }
    }

    private bool IsTokenValid()
    {
        return _accessToken is not null && DateTimeOffset.UtcNow < _accessTokenExpiresAt;
    }

    private sealed record ServiceGuardTokenResponse(
        [property: JsonPropertyName("access_token")] string AccessToken,
        [property: JsonPropertyName("expires_in")] int ExpiresInSeconds);
}

public sealed class ServiceGuardAuthHandler : DelegatingHandler
{
    private readonly ServiceGuardTokenProvider _tokenProvider;

    public ServiceGuardAuthHandler(ServiceGuardTokenProvider tokenProvider)
    {
        _tokenProvider = tokenProvider;
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        string accessToken = await _tokenProvider.GetAccessTokenAsync(forceRefresh: false, cancellationToken).ConfigureAwait(false);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        HttpResponseMessage response = await base.SendAsync(request, cancellationToken).ConfigureAwait(false);
        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            // 401 — однократный повтор с принудительным обновлением токена.
            response.Dispose();
            string refreshedToken = await _tokenProvider.GetAccessTokenAsync(forceRefresh: true, cancellationToken).ConfigureAwait(false);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", refreshedToken);
            response = await base.SendAsync(request, cancellationToken).ConfigureAwait(false);
        }

        // 403 не повторяем: нехватка роли либо бизнес-запрет (forbidden).
        return response;
    }
}
```

## 3. Константы

```csharp
public static class HrTekHttpClientNames
{
    public const string ServiceGuard = "ServiceGuardTokenClient";
    public const string Gateway = "HrTekGatewayClient";
}

public static class HrTekHeaderNames
{
    public const string UserId = "X-User-Id";
    public const string Side = "X-Side";
}

public static class HrTekActionTypes
{
    public const string Upload = "upload";
    public const string Completed = "completed";
}
```

## 4. DTO

```csharp
public sealed record CreateEventRequest(
    [property: JsonPropertyName("event_type_id")] string EventTypeId,
    [property: JsonPropertyName("employee_id")] string? EmployeeId);

public sealed record IdResponse(
    [property: JsonPropertyName("id")] string Id);

public sealed record EventIdResponse(
    [property: JsonPropertyName("event_id")] string EventId);

public sealed record CancelEventRequest(
    [property: JsonPropertyName("reason_id")] int ReasonId,
    [property: JsonPropertyName("comment")] string? Comment = null);

public sealed record EventState(
    [property: JsonPropertyName("active_nodes")] IReadOnlyList<ActiveNode> ActiveNodes,
    [property: JsonPropertyName("documents")] IReadOnlyList<DocumentDto> Documents,
    [property: JsonPropertyName("permissions")] EventPermissions Permissions);

public sealed record ActiveNode(
    [property: JsonPropertyName("action")] NodeAction Action,
    [property: JsonPropertyName("node_id")] string? NodeId);

public sealed record NodeAction(
    [property: JsonPropertyName("type")] string Type);

public sealed record DocumentDto(
    [property: JsonPropertyName("id")] string Id);

public sealed record EventPermissions(
    [property: JsonPropertyName("cancel")] bool Cancel);
```

## 5. Регистрация в DI

```csharp
builder.Services.Configure<EsbKrakendConnectionOptions>(builder.Configuration.GetSection("EsbKrakend"));
builder.Services.AddSingleton<ServiceGuardTokenProvider>();
builder.Services.AddTransient<ServiceGuardAuthHandler>();

builder.Services.AddHttpClient(HrTekHttpClientNames.ServiceGuard);

builder.Services.AddHttpClient<HrTekClient>(static (serviceProvider, httpClient) =>
{
    EsbKrakendConnectionOptions options = serviceProvider
        .GetRequiredService<IOptions<EsbKrakendConnectionOptions>>().Value;
    httpClient.BaseAddress = new Uri(options.GatewayBaseUrl.TrimEnd('/') + "/");
    httpClient.Timeout = TimeSpan.FromSeconds(options.RequestTimeoutSeconds);
})
.AddHttpMessageHandler<ServiceGuardAuthHandler>();
```

## 6. Клиент базового процесса

```csharp
public sealed class HrTekClient
{
    private readonly HttpClient _httpClient;
    private readonly string _side;

    public HrTekClient(HttpClient httpClient, IOptions<EsbKrakendConnectionOptions> options)
    {
        _httpClient = httpClient;
        _side = options.Value.Side;
    }

    public async Task<string> ResolveUserIdBySnilsAsync(string snils, CancellationToken cancellationToken)
    {
        // X-User-Id ещё неизвестен и для by_snils не требуется.
        string requestUri = $"user/by_snils?snils={Uri.EscapeDataString(snils)}";
        IdResponse response = await _httpClient
            .GetFromJsonAsync<IdResponse>(requestUri, cancellationToken)
            .ConfigureAwait(false)
            ?? throw new InvalidOperationException("Пустой ответ user/by_snils.");
        return response.Id;
    }

    public async Task<string> CreateEventAsync(string userId, CreateEventRequest body, CancellationToken cancellationToken)
    {
        using HttpRequestMessage request = CreateRequest(HttpMethod.Post, "event", userId);
        request.Content = JsonContent.Create(body);

        using HttpResponseMessage response = await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
        await EnsureSuccessAsync(response, cancellationToken).ConfigureAwait(false);

        EventIdResponse eventIdResponse = await response.Content
            .ReadFromJsonAsync<EventIdResponse>(cancellationToken)
            .ConfigureAwait(false)
            ?? throw new InvalidOperationException("Пустой ответ POST /event.");
        return eventIdResponse.EventId;
    }

    public async Task<EventState> GetEventAsync(string userId, string eventId, CancellationToken cancellationToken)
    {
        using HttpRequestMessage request = CreateRequest(HttpMethod.Get, $"event/{eventId}", userId);
        using HttpResponseMessage response = await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
        await EnsureSuccessAsync(response, cancellationToken).ConfigureAwait(false);

        return await response.Content
            .ReadFromJsonAsync<EventState>(cancellationToken)
            .ConfigureAwait(false)
            ?? throw new InvalidOperationException("Пустой ответ GET /event.");
    }

    public async Task UploadDocumentAsync(string userId, string eventId, string nodeId,
        Stream document, string fileName, CancellationToken cancellationToken)
    {
        using MultipartFormDataContent form = new()
        {
            { new StreamContent(document), "document", fileName },
        };
        // Атрибуты этапа (если требуются) — отдельными полями attributes[<id>], где <id> = form_attributes[].id.
        // Полный механизм — reference.data-models.md, раздел «Передача атрибутов». Пример:
        //   form.Add(new StringContent(attributeTextValue), $"attributes[{attributeId}]");                 // type=text
        //   form.Add(new StreamContent(attributeFileStream), $"attributes[{attributeId}]", attributeFileName); // type=file
        // Если form_attributes пуст — поля attributes[...] не добавляются.
        using HttpRequestMessage request = CreateRequest(HttpMethod.Post, $"event/{eventId}/{nodeId}/upload", userId);
        request.Content = form;

        using HttpResponseMessage response = await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
        await EnsureSuccessAsync(response, cancellationToken).ConfigureAwait(false);
    }

    public async Task<Stream> DownloadSignedPdfAsync(string userId, string eventId, string documentId, CancellationToken cancellationToken)
    {
        using HttpRequestMessage request = CreateRequest(
            HttpMethod.Get, $"event/{eventId}/document/{documentId}/file_with_stamp", userId);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/pdf"));

        HttpResponseMessage response = await _httpClient
            .SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken)
            .ConfigureAwait(false);
        await EnsureSuccessAsync(response, cancellationToken).ConfigureAwait(false);

        return await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>Возвращает true — Заявка отменена; false — отмена запрещена (завершённая Заявка, 403 forbidden).</summary>
    public async Task<bool> CancelEventAsync(string userId, string eventId, int reasonId, CancellationToken cancellationToken)
    {
        using HttpRequestMessage request = CreateRequest(HttpMethod.Post, $"event/{eventId}/cancel", userId);
        request.Content = JsonContent.Create(new CancelEventRequest(reasonId));

        using HttpResponseMessage response = await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
        if (response.StatusCode == HttpStatusCode.Forbidden)
        {
            return false;
        }

        await EnsureSuccessAsync(response, cancellationToken).ConfigureAwait(false);
        return true;
    }

    private HttpRequestMessage CreateRequest(HttpMethod httpMethod, string relativeUrl, string userId)
    {
        HttpRequestMessage request = new(httpMethod, relativeUrl);
        request.Headers.Add(HrTekHeaderNames.UserId, userId);
        request.Headers.Add(HrTekHeaderNames.Side, _side);
        return request;
    }

    private static async Task EnsureSuccessAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        if (response.IsSuccessStatusCode)
        {
            return;
        }

        string responseBody = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        throw new HttpRequestException(
            $"VK HR Tek вернул {(int)response.StatusCode}: {responseBody}", inner: null, response.StatusCode);
    }
}
```

## 7. Оркестрация (запуск → поллинг → файл)

```csharp
public sealed class HrTekSigningOrchestrator
{
    private const int PollingIntervalSeconds = 15;
    private const int PollingTimeoutMinutes = 30;

    private readonly HrTekClient _client;

    public HrTekSigningOrchestrator(HrTekClient client)
    {
        _client = client;
    }

    public async Task<byte[]> RunSigningAsync(string snils, string eventTypeId, string employeeId,
        Stream document, CancellationToken cancellationToken)
    {
        string userId = await _client.ResolveUserIdBySnilsAsync(snils, cancellationToken).ConfigureAwait(false);
        string eventId = await _client
            .CreateEventAsync(userId, new CreateEventRequest(eventTypeId, employeeId), cancellationToken)
            .ConfigureAwait(false);

        EventState state = await _client.GetEventAsync(userId, eventId, cancellationToken).ConfigureAwait(false);
        ActiveNode uploadNode = state.ActiveNodes.First(node => node.Action.Type == HrTekActionTypes.Upload);
        string nodeId = uploadNode.NodeId
            ?? throw new InvalidOperationException("Активный этап загрузки не содержит node_id.");

        await _client.UploadDocumentAsync(userId, eventId, nodeId, document, "document.pdf", cancellationToken)
            .ConfigureAwait(false);

        string documentId = await WaitForSignedDocumentAsync(userId, eventId, cancellationToken).ConfigureAwait(false);

        await using Stream pdfStream = await _client
            .DownloadSignedPdfAsync(userId, eventId, documentId, cancellationToken)
            .ConfigureAwait(false);
        using MemoryStream memoryStream = new();
        await pdfStream.CopyToAsync(memoryStream, cancellationToken).ConfigureAwait(false);
        return memoryStream.ToArray();
    }

    private async Task<string> WaitForSignedDocumentAsync(string userId, string eventId, CancellationToken cancellationToken)
    {
        // Статус определяется поллингом — вебхуков у API нет.
        using CancellationTokenSource pollingTimeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        pollingTimeout.CancelAfter(TimeSpan.FromMinutes(PollingTimeoutMinutes));

        while (!pollingTimeout.IsCancellationRequested)
        {
            EventState state = await _client.GetEventAsync(userId, eventId, pollingTimeout.Token).ConfigureAwait(false);
            bool isCompleted = state.ActiveNodes.Any(node => node.Action.Type == HrTekActionTypes.Completed);
            if (isCompleted && state.Documents.Count > 0)
            {
                return state.Documents[0].Id;
            }

            await Task.Delay(TimeSpan.FromSeconds(PollingIntervalSeconds), pollingTimeout.Token).ConfigureAwait(false);
        }

        throw new TimeoutException("Подписание не завершено за отведённое время.");
    }
}
```

> Подписание (УНЭП/УКЭП/ПЭП) выполняется на соответствующих этапах — см. `reference.signing-*.md`. Для разделения успех/ошибка можно обернуть результат в `ProcessingResult<T>` (`skill.dev.ru.processing-result-pattern`). 401 — один повтор (в `ServiceGuardAuthHandler`); 403 — нехватка роли либо `forbidden` при отмене завершённой Заявки. Секреты — только из конфигурации/секрет-менеджера.
