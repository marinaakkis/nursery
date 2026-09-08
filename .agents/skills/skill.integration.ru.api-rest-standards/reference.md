# .NET REST API — справочник (примеры)

Дополнение к `SKILL.md`. Примеры URL-паттернов, контроллеров и атрибутов.

## URL-паттерны — полный набор для сущности

```
GET    /api/v1/users                          → список пользователей
GET    /api/v1/users/{userId}                 → пользователь по ID (200 / 404)
POST   /api/v1/users                          → создать пользователя (201)
PUT    /api/v1/users/{userId}                 → обновить пользователя (200)
DELETE /api/v1/users/{userId}                 → удалить пользователя (200 / 204)
PATCH  /api/v1/users/{userId}/display-name    → обновить свойство display-name (200)

POST   /api/v1/users/search                   → поиск пользователей (200)
POST   /api/v1/users/get-registry             → постраничный реестр (200)
POST   /api/v1/reports/{reportName}/download  → скачать отчёт (200)
```

## GET — получение по ID

```csharp
[HttpGet("{userId:guid}")]
[ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
public async Task<ActionResult<UserDto>> GetById(Guid userId)
{
    var user = await _userService.GetByIdAsync(userId);
    if (user is null) return NotFound();
    return Ok(user);
}
```

## POST — создание (201 Created)

```csharp
[HttpPost]
[ProducesResponseType(typeof(UserDto), StatusCodes.Status201Created)]
[ProducesResponseType(StatusCodes.Status400BadRequest)]
public async Task<ActionResult<UserDto>> Create([FromBody] UserToCreate dto)
{
    var created = await _userService.CreateAsync(dto);
    return CreatedAtAction(nameof(GetById), new { userId = created.Id }, created);
}
```

## PUT — полное обновление

```csharp
[HttpPut("{userId:guid}")]
[ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
public async Task<ActionResult<UserDto>> Update(Guid userId, [FromBody] UserToUpdate dto)
{
    var updated = await _userService.UpdateAsync(userId, dto);
    if (updated is null) return NotFound();
    return Ok(updated);
}
```

## DELETE — удаление

```csharp
// Вариант с телом ответа (200)
[HttpDelete("{userId:guid}")]
[ProducesResponseType(typeof(Guid), StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
public async Task<ActionResult<Guid>> Delete(Guid userId)
{
    var deletedId = await _userService.DeleteAsync(userId);
    if (deletedId is null) return NotFound();
    return Ok(deletedId);
}

// Вариант без тела ответа (204)
[HttpDelete("{userId:guid}")]
[ProducesResponseType(StatusCodes.Status204NoContent)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
public async Task<IActionResult> Delete(Guid userId)
{
    var found = await _userService.DeleteAsync(userId);
    if (!found) return NotFound();
    return NoContent();
}
```

## PATCH — обновление свойства

```csharp
[HttpPatch("{userId:guid}/display-name")]
[ProducesResponseType(typeof(string), StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
public async Task<ActionResult<string>> UpdateDisplayName(
    Guid userId, [FromBody] string displayName)
{
    var updated = await _userService.UpdateDisplayNameAsync(userId, displayName);
    if (updated is null) return NotFound();
    return Ok(updated);
}
```

## POST-операция — поиск

```csharp
[HttpPost("search")]
[ProducesResponseType(typeof(IEnumerable<UserDto>), StatusCodes.Status200OK)]
public async Task<ActionResult<IEnumerable<UserDto>>> Search(
    [FromBody] UserSearchConditions conditions)
{
    var results = await _userService.SearchAsync(conditions);
    return Ok(results);
}
```

## POST-операция — постраничный реестр

```csharp
[HttpPost("get-registry")]
[ProducesResponseType(typeof(UsersRegistryPage), StatusCodes.Status200OK)]
public async Task<ActionResult<UsersRegistryPage>> GetRegistry(
    [FromBody] RegistryPaginator paginator)
{
    var page = await _userService.GetRegistryAsync(paginator);
    return Ok(page);
}
```

## POST-операция — скачивание файла

```csharp
[HttpPost("{reportName}/download")]
[ProducesResponseType(typeof(FileResult), StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
public async Task<IActionResult> Download(string reportName)
{
    var file = await _reportService.GetFileAsync(reportName);
    if (file is null) return NotFound();
    return File(file.Content, file.ContentType, file.FileName);
}
```

## GET — список всех сущностей

```csharp
[HttpGet]
[ProducesResponseType(typeof(IEnumerable<UserDto>), StatusCodes.Status200OK)]
public async Task<ActionResult<IEnumerable<UserDto>>> GetAll()
{
    var users = await _userService.GetAllAsync();
    return Ok(users);
}
```

## Примечание: ActionResult\<T\> vs IActionResult

В документации команды этот тип называется `IActionResult<TResult>`. В ASP.NET Core правильное имя — **`ActionResult<TResult>`** (класс, реализующий `IActionResult`). Именно `ActionResult<T>` поддерживает неявное приведение `T` и `IActionResult`, что позволяет возвращать как `Ok(value)`, так и `NotFound()` без явного приведения типов.
