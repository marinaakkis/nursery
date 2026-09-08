// publish-dev-requests-docs.test.mjs — тесты publish-dev-requests-docs.
// node:test + node:assert/strict; стаб через node:http; mocked fetch; временные фикстуры.
// Запуск: node --test scripts/publish-dev-requests-docs/
// Node.js 18+ ESM, stdlib-only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';

import {
  validateMetadata, createDefaultMetadata, readProjectMetadata, writeProjectMetadata,
} from '../utilities/project-metadata-helper.mjs';
import { resolveRequest, buildManifest, classifyKind } from '../utilities/prepare-dev-requests-docs.mjs';
import { CircuitBreaker, requestWithReliability, HttpError } from '../utilities/http.mjs';
import { planClean, applyClean } from '../utilities/clean-published-dev-requests.mjs';
import { createStubAdapter } from '../docs-storage-api-clients/stub/adapter.mjs';
import { selectAdapter, listBackends } from '../docs-storage-api-client-factory/index.mjs';
import { runPublishDoneRequests as runPublish } from '../publish-dev-requests-docs.mjs';

const NOOP_SLEEP = async () => {};

// ---- фикстура temp-репозитория ----
function makeFixture({ artifacts, status = 'DONE', backend = 'stub' }) {
  const root = mkdtempSync(join(tmpdir(), 'publish-dr-'));
  const reqDir = join(root, 'docs', 'dev-requests', 'dev-request.r-900.fixture');
  mkdirSync(reqDir, { recursive: true });
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'architecture.md'), '# Architecture Index\n\n## Ручная секция\nНе трогать.\n');
  writeFileSync(
    join(reqDir, 'dev-process-plan.r-900.fixture.md'),
    `# Plan\n\n| **Текущая фаза** | ${status} |\n`,
  );
  for (const a of artifacts) {
    const full = join(reqDir, a.rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, a.content);
  }
  writeProjectMetadata(root, { ...createDefaultMetadata(), docsStorage: backend === 'stub' ? { backend } : { backend, baseUrl: null, projectKey: null } });
  return { root, reqDir };
}

// ============ t-001 metadata ============
test('TC-meta: validate + read/write идемпотентны', () => {
  const root = mkdtempSync(join(tmpdir(), 'meta-'));
  const meta = createDefaultMetadata();
  const f1 = writeProjectMetadata(root, meta);
  const a = readFileSync(f1, 'utf8');
  writeProjectMetadata(root, readProjectMetadata(root));
  const b = readFileSync(f1, 'utf8');
  assert.equal(a, b, 'повторная запись не меняет байты');
});

test('TC-meta: backend вне enum → ошибка', () => {
  assert.throws(() => validateMetadata({ projectName: 'p', docsStorage: { backend: 'notreal' } }), /backend must be one of/);
});

test('SEC-meta: поле токена в метаданных → ошибка', () => {
  assert.throws(() => validateMetadata({ projectName: 'p', docsStorage: { backend: 'stub', token: 'x' } }), /not valid for backend/);
  assert.throws(() => validateMetadata({ projectName: 'p', apiKey: 'y' }), /secret-like field/);
});

// ============ t-002 select ============
test('TC-002: classifyKind', () => {
  assert.equal(classifyKind('research.r-1.x.md'), 'research');
  assert.equal(classifyKind('design/adr-log/adr.001.x.md'), 'adr');
  assert.equal(classifyKind('design/c4-diagrams/c1.x.md'), 'diagram');
  assert.equal(classifyKind('dev-planning/dev-plan.x/dev-task.r-1.t-001.x.md'), 'dev-task');
  assert.equal(classifyKind('dev-process-plan.r-1.x.md'), 'process-plan');
});

test('TC-002: resolveRequest + buildManifest (DONE)', () => {
  const { root } = makeFixture({ artifacts: [{ rel: 'research.r-900.fixture.md', content: '# r\nтекст\n' }] });
  const req = resolveRequest(root, { request: 'r-900' });
  assert.equal(req.id, 'r-900');
  const man = buildManifest(req.dir, { onlyDone: true });
  assert.equal(man.status, 'DONE');
  assert.ok(man.artifacts.some((a) => a.kind === 'research' && a.include));
});

test('TC-002: onlyDone на IN_PROGRESS → пустой include + причина', () => {
  const { root } = makeFixture({ status: 'PLANNING', artifacts: [{ rel: 'research.r-900.fixture.md', content: 'x' }] });
  const req = resolveRequest(root, { request: 'r-900' });
  const man = buildManifest(req.dir, { onlyDone: true });
  assert.equal(man.status, 'IN_PROGRESS');
  assert.ok(man.reason);
  assert.ok(man.artifacts.every((a) => a.include === false));
});

// ============ t-004 http ============
test('TC-004: CircuitBreaker open → half-open', () => {
  let t = 0;
  const cb = new CircuitBreaker({ threshold: 2, cooldownMs: 100, now: () => t });
  cb.recordFailure();
  assert.equal(cb.state, 'closed');
  cb.recordFailure();
  assert.equal(cb.state, 'open');
  t = 100;
  assert.equal(cb.state, 'half-open');
  cb.recordSuccess();
  assert.equal(cb.state, 'closed');
});

test('TC-004: 4xx не ретраится', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return new Response('bad', { status: 400 }); };
  const res = await requestWithReliability('http://x', { fetchImpl, sleepImpl: NOOP_SLEEP });
  assert.equal(res.status, 400);
  assert.equal(calls, 1);
});

test('TC-004: 5xx ретраится и размыкает breaker', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return new Response('err', { status: 500 }); };
  const breaker = new CircuitBreaker({ threshold: 3, cooldownMs: 1000, now: () => 0 });
  await assert.rejects(
    requestWithReliability('http://x', { fetchImpl, sleepImpl: NOOP_SLEEP, retries: 3, breaker }),
    (e) => e instanceof HttpError,
  );
  assert.ok(calls >= 3, `ожидались повторы, было ${calls}`);
});

test('TC-004: timeout/throw ретраится', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw new Error('timeout'); };
  await assert.rejects(requestWithReliability('http://x', { fetchImpl, sleepImpl: NOOP_SLEEP, retries: 2 }));
  assert.equal(calls, 3);
});

test('TC-004-int: реальный node:http happy-path', async () => {
  const server = http.createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  try {
    const res = await requestWithReliability(`http://127.0.0.1:${port}/`, { sleepImpl: NOOP_SLEEP });
    assert.equal(res.ok, true);
    assert.deepEqual(res.body, { ok: true });
  } finally {
    server.close();
  }
});

// ============ stub adapter + factory ============
test('TC-stub: upsert идемпотентен, search находит', async () => {
  const a = createStubAdapter();
  const cfg = { projectKey: 'P' };
  const r1 = await a.upsertDocument({ key: 'k1', content: 'hello world', title: 't' }, cfg);
  assert.equal(r1.created, true);
  const r2 = await a.upsertDocument({ key: 'k1', content: 'hello world', title: 't' }, cfg);
  assert.equal(r2.created, false);
  assert.equal(a._store.get('P').size, 1);
  const s = await a.search({ q: 'hello' }, cfg);
  assert.equal(s.results.length, 1);
  assert.equal((await a.health()).status, 'ok');
});

test('TC-factory: selectAdapter + unknown', () => {
  assert.ok(listBackends().includes('obsidian'));
  assert.ok(listBackends().includes('stub'));
  assert.throws(() => selectAdapter('nope'), /unknown backend/);
});

// ============ t-006 clean ============
test('TC-006: applyClean удаляет всю папку целиком', () => {
  const dir = mkdtempSync(join(tmpdir(), 'clean-'));
  mkdirSync(join(dir, 'design'), { recursive: true });
  writeFileSync(join(dir, 'dev-process-plan.x.md'), 'plan');
  writeFileSync(join(dir, 'design', 'design-report.md'), 'd');
  const manifest = [
    { relativePath: 'dev-process-plan.x.md', kind: 'process-plan', include: true },
    { relativePath: 'design/design-report.md', kind: 'design', include: true },
  ];
  const plan = planClean(dir, manifest);
  const { dir: removed } = applyClean(plan);
  assert.equal(removed, dir);
  assert.ok(!existsSync(dir), 'вся папка удалена');
});

// ============ t-008/t-010 e2e runPublish ============
test('TC-e2e: dry-run ничего не пишет/не пушит и не удаляет', async () => {
  const { root, reqDir } = makeFixture({ artifacts: [{ rel: 'research.r-900.fixture.md', content: '# r\nчисто\n' }] });
  const adapter = createStubAdapter();
  const out = await runPublish({ root, request: 'r-900', backend: 'stub', adapter, confirm: false });
  assert.equal(out.dryRun, true);
  assert.equal(adapter._store.size, 0, 'в dry-run ничего не отправлено');
  assert.ok(existsSync(reqDir), 'папка запроса не тронута в dry-run');
});

test('TC-e2e: confirm публикует и удаляет папку запроса', async () => {
  const { root, reqDir } = makeFixture({
    artifacts: [
      { rel: 'research.r-900.fixture.md', content: '# r\nчисто\n' },
      { rel: 'design/adr-log/adr.001.r-900.x.md', content: '# adr\nчисто\n' },
    ],
  });
  const adapter = createStubAdapter();
  const out = await runPublish({ root, request: 'r-900', backend: 'stub', adapter, confirm: true });
  assert.ok(out.published >= 2);
  assert.ok(!existsSync(reqDir), 'папка запроса удалена после публикации');
});

