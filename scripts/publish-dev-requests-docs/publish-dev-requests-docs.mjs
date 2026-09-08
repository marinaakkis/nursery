#!/usr/bin/env node
// publish-dev-requests-docs.mjs — публикация артефактов dev-requests в документальное хранилище.
// Три режима (3 стадии: init → prepare → publish; опц. стадия clean при --with-clean):
//   (default)   — публикует все DONE dev-requests
//   --all-docs   — публикует всё дерево docs/dev-requests/ as-is, без очистки
//   --docs-path <path>— публикует конкретный файл или папку внутри docs/dev-requests/
// Иерархия в хранилище: <projectKey>/<путь-относительно-docs/dev-requests/>
// НЕ выполняет git add/commit/push. Node.js 18+ ESM, stdlib-only.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readProjectMetadata } from './utilities/project-metadata-helper.mjs';
import {
  resolveRequest, buildManifest, listRequests,
  collectFiles, resolveDocsPath, DEV_REQUESTS_REL,
} from './utilities/prepare-dev-requests-docs.mjs';
import { CircuitBreaker } from './utilities/http.mjs';
import { planClean, applyClean } from './utilities/clean-published-dev-requests.mjs';
import { selectAdapter } from './docs-storage-api-client-factory/index.mjs';
import { artifactKey } from './docs-storage-api-client-factory/contract.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(SCRIPT_DIR, '..', '..');

function deriveTitle(relPath) {
  return relPath.split('/').pop().replace(/\.md$/i, '');
}

function buildConfig(meta, backendOpt) {
  const backend = backendOpt ?? meta.docsStorage?.backend ?? 'stub';
  // Поле токена зависит от стратегии backend (хранится в gitignored .project-metadata.local.json).
  // Новая стратегия добавляет свой case, выбирая apiKey или apiToken.
  let token;
  switch (backend) {
    case 'obsidian':
      token = meta.docsStorage?.apiKey ?? null; // Obsidian Local REST API — API Key
      break;
    case 'stub':
      token = null; // in-memory адаптер — токен не нужен
      break;
    // Расширение (пример) — выберите поле токена для нового backend:
    //   case 'onyx':      token = meta.docsStorage?.apiKey ?? null; break;
    //   case 'atlassian': token = meta.docsStorage?.apiToken ?? null; break;
    default:
      throw new Error(
        `Незарегистрированный тип сервиса публикации артефактов: "${backend}". ` +
        `Реализуйте стратегию-адаптер и добавьте case выбора токена в buildConfig ` +
        `(см. scripts/publish-dev-requests-docs/README.md).`,
      );
  }

  return {
    backend,
    baseUrl: meta.docsStorage?.baseUrl ?? null,
    projectKey: meta.docsStorage?.projectKey ?? null,
    token,
    email: meta.docsStorage?.accountEmail ?? undefined,
    rovo: meta.docsStorage?.rovo ?? false,
    breaker: new CircuitBreaker(),
  };
}

// ─── Режим 1: публикация всех DONE dev-requests (5 стадий с очисткой) ───────

export async function runPublishDoneRequests(options = {}) {
  const {
    root = REPO_ROOT, request, backend: backendOpt,
    onlyDone = true, confirm = true, withClean = false,
    adapter: adapterOverride, logger = console,
  } = options;
  const log = (msg) => logger.log?.(msg);

  // Stage 1 — init-dev-requests-publishing
  const meta = readProjectMetadata(root);
  const req = resolveRequest(root, { request });
  log(`[init] ${req.id} (${req.name})`);

  // Stage 2 — prepare-dev-requests
  const manifest = buildManifest(req.dir, { onlyDone });
  const included = manifest.artifacts.filter((a) => a.include);
  if (included.length === 0) {
    log(`[prepare] нечего публиковать: ${manifest.reason ?? 'манифест пуст'}`);
    return { id: req.id, status: manifest.status, published: 0, dryRun: !confirm, reason: manifest.reason };
  }
  log(`[prepare] артефактов: ${included.length} (status=${manifest.status})`);

  const config = buildConfig(meta, backendOpt);
  const storageRef = `${config.baseUrl ?? config.backend}/${config.projectKey}`;

  if (!confirm) {
    log(`[dry-run] будет опубликовано ${included.length} файлов → ${config.backend}:${config.projectKey}/${req.folderName}/`);
    return { id: req.id, dryRun: true, wouldPublish: included.length, backend: config.backend, storageRef };
  }

  // Stage 3 — publish-dev-requests
  // doc.path = <folderName>/<relativePath> → vault: <projectKey>/<folderName>/<relativePath>
  const adapter = adapterOverride ?? selectAdapter(config.backend);
  const results = await Promise.all(included.map((item) => {
    const content = readFileSync(join(req.dir, item.relativePath), 'utf8');
    const vaultRelPath = `${req.folderName}/${item.relativePath}`;
    return adapter.upsertDocument({
      key: artifactKey(vaultRelPath),
      path: vaultRelPath,
      title: deriveTitle(item.relativePath),
      kind: item.kind,
      content,
      tags: [req.id, item.kind],
    }, config);
  }));
  log(`[publish] опубликовано ${results.length}/${included.length} → ${config.backend}:${config.projectKey}/${req.folderName}/`);

  // Stage 4 — clean-published-dev-requests (только при --with-clean)
  if (withClean) {
    const { dir: cleanedDir } = applyClean(planClean(req.dir, manifest.artifacts));
    log(`[clean] удалена папка: ${cleanedDir}`);
  }

  return { id: req.id, dryRun: false, published: results.length, backend: config.backend, storageRef };
}

// ─── Режим 2 и 3: публикация произвольных doc-файлов без очистки ─────────────

async function pushFiles(files, cleanTarget, options) {
  const {
    root = REPO_ROOT, backend: backendOpt,
    confirm = true, withClean = false, adapter: adapterOverride, logger = console,
  } = options;
  const log = (msg) => logger.log?.(msg);

  const meta = readProjectMetadata(root);

  const config = buildConfig(meta, backendOpt);
  const storageRef = `${config.baseUrl ?? config.backend}/${config.projectKey}`;

  if (!confirm) {
    log(`[dry-run] будет опубликовано ${files.length} файлов → ${config.backend}:${config.projectKey}/`);
    return { dryRun: true, wouldPublish: files.length, backend: config.backend, storageRef };
  }

  const adapter = adapterOverride ?? selectAdapter(config.backend);
  const results = await Promise.all(files.map(({ absolutePath, relativePath }) => {
    const content = readFileSync(absolutePath, 'utf8');
    return adapter.upsertDocument({
      key: artifactKey(relativePath),
      path: relativePath,
      title: deriveTitle(relativePath),
      content,
      tags: [],
    }, config);
  }));
  log(`[publish] опубликовано ${results.length}/${files.length} → ${config.backend}:${config.projectKey}/`);

  if (withClean && cleanTarget) {
    const { dir: cleanedDir } = applyClean(planClean(cleanTarget, []));
    log(`[clean] удалено: ${cleanedDir}`);
  }

  return { dryRun: false, published: results.length, backend: config.backend, storageRef };
}

export async function runPublishAllDocs(options = {}) {
  const { root = REPO_ROOT, logger = console } = options;
  const log = (msg) => logger.log?.(msg);
  const devRequestsBase = join(root, DEV_REQUESTS_REL);
  const files = collectFiles(devRequestsBase, devRequestsBase);
  log(`[prepare] файлов в docs/dev-requests/: ${files.length}`);
  return pushFiles(files, devRequestsBase, options);
}

export async function runPublishDocsAtPath(pathSpec, options = {}) {
  const { root = REPO_ROOT, logger = console } = options;
  const log = (msg) => logger.log?.(msg);
  const devRequestsBase = join(root, DEV_REQUESTS_REL);
  const target = resolveDocsPath(root, pathSpec);
  const files = collectFiles(devRequestsBase, target);
  log(`[prepare] файлов по пути "${pathSpec}": ${files.length}`);
  return pushFiles(files, target, options);
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const o = { confirm: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--request')       o.request = argv[++i];
    else if (a === '--dry-run')    o.confirm = false;
    else if (a === '--with-clean') o.withClean = true;
    else if (a === '--all-docs')   o.allDocs = true;
    else if (a === '--docs-path')       o.docsPath = argv[++i];
    else if (a === '--help' || a === '-h') o.help = true;
  }
  return o;
}

const HELP = `publish-dev-requests-docs — публикация документации dev-requests в хранилище

Использование:
  node scripts/publish-dev-requests-docs/publish-dev-requests-docs.mjs [опции]

Режимы (взаимоисключающие):
  (без флага)          Публикует все DONE dev-requests
  --all-docs           Публикует всё дерево docs/dev-requests/ as-is
  --docs-path <путь>        Публикует файл или папку внутри docs/dev-requests/
                       (<путь> — абсолютный, относительный от cwd, или имя папки)

Опции:
  --with-clean        Удалить опубликованные файлы/папки после успешной публикации
                      (во всех режимах)
  --request r-<nnn>   Конкретный dev-request (только в режиме по умолчанию)
  --dry-run           Показать план без реальной публикации
  --help              Эта справка

Иерархия в хранилище: <projectKey>/<путь-относительно-docs/dev-requests/>
Секреты — из .project-metadata.local.json → docsStorage (apiKey / apiToken).
Скрипт НЕ выполняет git add/commit/push.`;

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { console.log(HELP); return 0; }

  let summary;
  if (opts.allDocs) {
    summary = await runPublishAllDocs(opts);
  } else if (opts.docsPath) {
    summary = await runPublishDocsAtPath(opts.docsPath, opts);
  } else {
    // Режим по умолчанию: все DONE-запросы
    const ids = listRequests(REPO_ROOT);
    if (ids.length === 0) { console.log('Нет завершённых запросов для публикации.'); return 0; }
    let total = 0, failed = 0;
    for (const id of ids) {
      console.log(`\n=== ${id} ===`);
      try {
        const s = await runPublishDoneRequests({ ...opts, request: id });
        console.log(JSON.stringify(s, null, 2));
        total += s.published ?? 0;
      } catch (e) {
        console.error(`[${id}] ошибка: ${e.message}`);
        failed++;
      }
    }
    console.log(`\nИтого: ${total} файлов из ${ids.length} запросов (ошибок: ${failed})`);
    return failed > 0 ? 1 : 0;
  }

  console.log(JSON.stringify(summary, null, 2));
  return summary?.exitCode ?? 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`publish-dev-requests-docs: ${e.message}`);
      process.exit(1);
    });
}
