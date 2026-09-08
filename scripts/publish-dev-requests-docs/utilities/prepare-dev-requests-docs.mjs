// prepare-dev-requests-docs.mjs — разрешение dev-request и сбор манифеста артефактов (stage: prepare-dev-requests).
// Node.js 18+ ESM, stdlib-only.

import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, sep, resolve, isAbsolute } from 'node:path';

export const DEV_REQUESTS_REL = join('docs', 'dev-requests');

function assert(cond, msg) {
  if (!cond) throw new Error(`prepare: ${msg}`);
}

// Возвращает все ID запросов (r-001, r-002, …) в docs/dev-requests/.
export function listRequests(root) {
  const base = join(root, DEV_REQUESTS_REL);
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .filter((n) => n.startsWith('dev-request.r-') && statSync(join(base, n)).isDirectory())
    .map((n) => { const m = n.match(/^dev-request\.(r-\d+)\./); return m ? m[1] : null; })
    .filter(Boolean)
    .sort();
}

export function resolveRequest(root, { request } = {}) {
  const base = join(root, DEV_REQUESTS_REL);
  assert(existsSync(base), `dev-requests dir not found: ${base}`);
  const entries = readdirSync(base).filter(
    (n) => n.startsWith('dev-request.r-') && statSync(join(base, n)).isDirectory(),
  );
  let chosen;
  if (request) {
    chosen = entries.find((n) => n.startsWith(`dev-request.${request}.`));
    assert(chosen, `dev-request "${request}" not found in ${base}`);
  } else {
    assert(entries.length === 1, `ambiguous: ${entries.length} dev-requests found — specify --request r-<nnn>`);
    chosen = entries[0];
  }
  const m = chosen.match(/^dev-request\.(r-\d+)\.(.+)$/);
  assert(m, `cannot parse dev-request folder name: ${chosen}`);
  return { id: m[1], name: m[2], folderName: chosen, dir: join(base, chosen) };
}

// Рекурсивно собирает .md файлы из dir.
// Возвращает [{ absolutePath, relativePath }], где relativePath — относительно baseDir.
export function collectFiles(baseDir, dir) {
  const results = [];
  function walk(current) {
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (name.toLowerCase().endsWith('.md')) {
        results.push({
          absolutePath: full,
          relativePath: relative(baseDir, full).split(sep).join('/'),
        });
      }
    }
  }
  walk(dir);
  return results;
}

// Разрешает аргумент --docs в абсолютный путь.
// pathSpec может быть: абсолютный путь, относительный от cwd, имя папки внутри dev-requests.
export function resolveDocsPath(root, pathSpec) {
  // 1. Абсолютный путь
  if (isAbsolute(pathSpec) && existsSync(pathSpec)) return pathSpec;
  // 2. Относительный от cwd
  const fromCwd = resolve(pathSpec);
  if (existsSync(fromCwd)) return fromCwd;
  // 3. Имя папки/файла внутри docs/dev-requests/
  const fromBase = join(root, DEV_REQUESTS_REL, pathSpec);
  if (existsSync(fromBase)) return fromBase;
  throw new Error(`--docs: path not found: ${pathSpec}`);
}

export function classifyKind(relPath) {
  const p = relPath.replace(/\\/g, '/').toLowerCase();
  const file = p.split('/').pop();
  if (p.includes('/adr-log/') || file.startsWith('adr.')) return 'adr';
  if (p.includes('/c4-diagrams/') || p.includes('/process-diagrams/') || p.includes('/data-models/')) return 'diagram';
  if (file.startsWith('research.')) return 'research';
  if (file.startsWith('dev-process-plan')) return 'process-plan';
  if (file.startsWith('dev-plan')) return 'dev-plan';
  if (file.startsWith('dev-task')) return 'dev-task';
  if (file.includes('pr-description')) return 'pr';
  if (file.includes('security') || file.includes('smoke') || p.includes('/testing/')) return 'report';
  if (p.includes('/design/') || file.startsWith('design-report')) return 'design';
  return 'doc';
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (st.isFile() && name.toLowerCase().endsWith('.md')) acc.push(full);
  }
  return acc;
}

// Статус определяется по полю «Текущая фаза» в dev-process-plan.
export function readRequestStatus(dir) {
  const planFile = readdirSync(dir).find((n) => n.startsWith('dev-process-plan'));
  if (!planFile) return 'UNKNOWN';
  const text = readFileSync(join(dir, planFile), 'utf8');
  const m = text.match(/\*\*Текущая фаза\*\*\s*\|\s*([A-Z]+)/);
  const phase = m ? m[1] : 'UNKNOWN';
  return phase === 'DONE' ? 'DONE' : 'IN_PROGRESS';
}

export function buildManifest(dir, { onlyDone = true } = {}) {
  const status = readRequestStatus(dir);
  const artifacts = walk(dir).map((f) => {
    const relativePath = relative(dir, f).split(sep).join('/');
    return { relativePath, kind: classifyKind(relativePath), include: true };
  });
  artifacts.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  if (onlyDone && status !== 'DONE') {
    return {
      status,
      reason: `request status is ${status}; onlyDone=true → nothing to publish`,
      artifacts: artifacts.map((a) => ({ ...a, include: false })),
    };
  }
  return { status, reason: null, artifacts };
}
