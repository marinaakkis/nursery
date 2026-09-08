// contract.mjs — контракт docs-storage клиента.
// Каждый адаптер реализует три метода:
//   upsertDocument(doc, config) -> { key, documentId, created, status }
//   search(query, config)       -> { results: [{ key, score, snippet }] }
//   health(config)              -> { status: 'ok' | 'degraded' | 'down' }
// где:
//   doc    = { key, path, title, kind, content, tags }
//            path — путь относительно docs/dev-requests/ (включает имя папки запроса)
//   config = { backend, baseUrl, projectKey, token }  // token приходит из env, не из метаданных
//   query  = { q, limit }
// Node.js 18+ ESM, stdlib-only.

export const ADAPTER_METHODS = ['upsertDocument', 'search', 'health'];

export function assertAdapter(adapter, id = adapter?.id ?? 'unknown') {
  if (!adapter || typeof adapter !== 'object') {
    throw new Error(`adapter "${id}": must be an object`);
  }
  for (const m of ADAPTER_METHODS) {
    if (typeof adapter[m] !== 'function') {
      throw new Error(`adapter "${id}": missing method ${m}()`);
    }
  }
  return true;
}

// Стабильный ключ артефакта между публикациями (для idempotent upsert).
export function artifactKey(relativePath) {
  return relativePath.replace(/\\/g, '/');
}
