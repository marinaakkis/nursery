// index.mjs — фабрика выбора бэкенд-адаптера (strategy pattern).
// Node.js 18+ ESM, stdlib-only.
//
// РАСШИРЕНИЕ (добавить публикацию в другой сервис, например Onyx или Confluence):
//   1. Реализуйте адаптер по контракту ./contract.mjs (методы upsertDocument/search/health)
//      в ../docs-storage-api-clients/<backend>/adapter.mjs. Образец интерфейса — stub-адаптер.
//   2. Импортируйте фабрику адаптера здесь и зарегистрируйте её в REGISTRY под именем backend.
//   3. Добавьте backend и его поля в utilities/project-metadata-helper.mjs (VALID_BACKENDS + shape).
// По умолчанию реализован только `obsidian` (локальная разработка) + `stub` (тесты).

import { assertAdapter } from './contract.mjs';
import { createStubAdapter } from '../docs-storage-api-clients/stub/adapter.mjs';
import { createObsidianAdapter } from '../docs-storage-api-clients/obsidian/adapter.mjs';

const REGISTRY = {
  // Реальное хранилище (локальная разработка):
  obsidian: createObsidianAdapter, // Obsidian Local REST API

  // Тест-инфра (in-memory, без egress); также образец для новых стратегий:
  stub: createStubAdapter,

  // Пример расширения — реализуйте адаптер по contract.mjs и раскомментируйте:
  // onyx: createOnyxAdapter,            // Onyx self-hosted RAG (REST API)
  // atlassian: createAtlassianAdapter,  // Atlassian Confluence REST API
};

export function listBackends() {
  return Object.keys(REGISTRY);
}

export function selectAdapter(backend) {
  const factory = REGISTRY[backend];
  if (!factory) {
    throw new Error(`unknown backend "${backend}"; available: ${listBackends().join(', ')}`);
  }
  const adapter = factory();
  assertAdapter(adapter, backend);
  return adapter;
}
