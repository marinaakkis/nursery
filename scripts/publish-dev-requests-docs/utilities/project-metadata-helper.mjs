// project-metadata-helper.mjs — чтение/запись .project-metadata.local.json.
// Локальные метаданные проекта (gitignored). Файл не коммитится — apiKey/apiToken хранить безопасно.
// Node.js 18+ ESM, stdlib-only.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const METADATA_FILENAME = '.project-metadata.local.json';
// Реализованные backend'ы. Расширяется при добавлении новой стратегии публикации
// (адаптер в docs-storage-api-clients/<backend>/ + запись в docs-storage-api-client-factory).
export const VALID_BACKENDS = ['obsidian', 'stub'];

// Свойства docsStorage, специфичные для каждого backend.
const DOCS_STORAGE_SHAPE = {
  obsidian:  ['backend', 'baseUrl', 'projectKey', 'apiKey', 'vaultPath'],
  stub:      ['backend'],
  // Расширение: добавьте поля нового backend, например onyx: ['backend','baseUrl','projectKey','apiKey'].
};

// Поля, похожие на секреты — запрещены в метаданных (хранить в env).
const SECRET_KEY_PATTERN = /(token|secret|password|passwd|apikey|api[_-]?key|bearer|credential)/i;

function assert(cond, msg) {
  if (!cond) throw new Error(`project-metadata: ${msg}`);
}

function scanNoSecrets(obj, path) {
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      // docsStorage.apiToken и docsStorage.email — явно разрешены (файл gitignored).
      if (path === 'docsStorage.' && (k === 'apiToken' || k === 'apiKey' || k === 'accountEmail')) continue;
      assert(!SECRET_KEY_PATTERN.test(k), `secret-like field "${path}${k}" is forbidden`);
      scanNoSecrets(v, `${path}${k}.`);
    }
  }
}

export function validateMetadata(meta) {
  assert(meta && typeof meta === 'object', 'must be an object');
  // projectName опциональное — может быть null/undefined (не задан при инициализации)
  if (meta.projectName != null) {
    assert(typeof meta.projectName === 'string', 'projectName must be a string if set');
  }
  if (meta.docsStorage) {
    const { backend } = meta.docsStorage;
    assert(VALID_BACKENDS.includes(backend),
      `docsStorage.backend must be one of: ${VALID_BACKENDS.join(', ')}`);
    const allowed = new Set(DOCS_STORAGE_SHAPE[backend] ?? []);
    for (const key of Object.keys(meta.docsStorage)) {
      assert(allowed.has(key), `docsStorage.${key} is not valid for backend "${backend}"`);
    }
  }
  if (meta.currentDevRequestNumber != null) {
    assert(typeof meta.currentDevRequestNumber === 'string' && /^r-\d+$/.test(meta.currentDevRequestNumber),
      'currentDevRequestNumber must be a string like "r-001"');
  }
  scanNoSecrets(meta, '');
  return true;
}

// Создаёт дефолтный файл метаданных (когда .project-metadata.local.json ещё не существует).
// projectName намеренно null — задаётся пользователем отдельно.
export function createDefaultMetadata() {
  return {
    projectName: null,
    currentDevRequestNumber: null,
    isGitHooksInited: false,
    docsStorage: null,
  };
}

// Строит объект docsStorage только с полями, разрешёнными для backend.
export function buildDocsStorage(backend, overrides = {}) {
  assert(VALID_BACKENDS.includes(backend), `unknown backend: ${backend}`);
  const defaults = {
    obsidian:  { backend, baseUrl: null, projectKey: null, apiKey: null, vaultPath: null },
    stub:      { backend },
  };
  const allowed = new Set(DOCS_STORAGE_SHAPE[backend]);
  const merged = { ...defaults[backend], ...overrides };
  return Object.fromEntries(Object.entries(merged).filter(([k]) => allowed.has(k)));
}

export function readProjectMetadata(root) {
  const file = join(root, METADATA_FILENAME);
  if (!existsSync(file)) {
    // Файл не существует — создаём с дефолтными значениями
    const defaults = createDefaultMetadata();
    writeFileSync(file, JSON.stringify(defaults, null, 2) + '\n', 'utf8');
    return defaults;
  }
  const content = readFileSync(file, 'utf8').replace(/^﻿/, ''); // strip UTF-8 BOM (PowerShell ConvertTo-Json | Set-Content adds it)
  const meta = JSON.parse(content);
  validateMetadata(meta);
  return meta;
}

export function writeProjectMetadata(root, meta) {
  validateMetadata(meta);
  const file = join(root, METADATA_FILENAME);
  writeFileSync(file, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  return file;
}

