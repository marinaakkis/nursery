// adapter.mjs — адаптер локального хранилища Obsidian.
// Через плагин Local REST API: PUT /vault/<path> (upsert .md), POST /search/simple (поиск).
// Auth: docsStorage.apiKey из .project-metadata.local.json.
// HTTPS с самоподписанным сертификатом Obsidian — используем localFetch с rejectUnauthorized=false.
// Node.js 18+ ESM, stdlib-only.

import { request as httpsRequest } from 'node:https';
import { URL } from 'node:url';
import { requestWithReliability } from '../../utilities/http.mjs';

// Fetch-совместимая функция для HTTPS с самоподписанным сертификатом (Obsidian localhost).
function localFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const { hostname, port, pathname, search } = new URL(url);
    const req = httpsRequest(
      {
        hostname,
        port: port || 443,
        path: pathname + (search || ''),
        method: options.method || 'GET',
        headers: options.headers || {},
        rejectUnauthorized: false, // Obsidian использует самоподписанный сертификат
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            text: () => Promise.resolve(text),
            json: () => Promise.resolve(JSON.parse(text)),
          });
        });
      },
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function trimUrl(u) {
  return (u ?? '').replace(/\/+$/, '');
}

function authHeaders(config) {
  return config.token ? { Authorization: config.token } : {};
}

function vaultPath(config, doc) {
  const prefix = config.projectKey ? `${config.projectKey}/` : '';
  const rel = (doc.path ?? doc.key).replace(/\\/g, '/');
  return (prefix + rel).split('/').map(encodeURIComponent).join('/');
}

function httpOpts(config, extra = {}) {
  return {
    breaker: config.breaker,
    fetchImpl: config.fetchImpl ?? localFetch, // localFetch обходит TLS-проверку для localhost
    sleepImpl: config.sleepImpl,
    ...(config.retries != null ? { retries: config.retries } : {}),
    ...extra,
  };
}

export function createObsidianAdapter() {
  return {
    id: 'obsidian',

    async upsertDocument(doc, config) {
      const url = `${trimUrl(config.baseUrl)}/vault/${vaultPath(config, doc)}`;
      const res = await requestWithReliability(
        url,
        httpOpts(config, {
          method: 'PUT',
          headers: { 'Content-Type': 'text/markdown', ...authHeaders(config) },
          body: doc.content ?? '',
        }),
      );
      if (!res.ok) throw new Error(`obsidian: upsert "${doc.key}" failed (${res.status})`);
      return { key: doc.key, documentId: vaultPath(config, doc), created: res.status === 201, status: res.status };
    },

    async search(query, config) {
      const url = `${trimUrl(config.baseUrl)}/search/simple/?query=${encodeURIComponent(query.q)}`;
      const res = await requestWithReliability(url, httpOpts(config, { method: 'POST', headers: authHeaders(config) }));
      const rows = Array.isArray(res.body) ? res.body : [];
      const results = rows.slice(0, query.limit ?? 10).map((r) => ({
        key: r.filename ?? r.path ?? '',
        score: r.score ?? 0,
        snippet: r.matches?.[0]?.context ?? '',
      }));
      return { results };
    },

    async health(config) {
      try {
        const res = await requestWithReliability(
          `${trimUrl(config.baseUrl)}/`,
          httpOpts(config, { headers: authHeaders(config), retries: 0 }),
        );
        return { status: res.ok ? 'ok' : 'degraded' };
      } catch {
        return { status: 'down' };
      }
    },
  };
}
