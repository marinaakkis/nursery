// http.mjs — надёжный HTTP-слой: timeout + retry(backoff) + circuit-breaker.
// rule.integration.ru.integration-passport-and-reliability-gate.
// Node.js 18+ ESM, stdlib-only (встроенный fetch, AbortSignal.timeout).

export const DEFAULT_TIMEOUT_MS = 30000;
export const DEFAULT_RETRIES = 3;
export const DEFAULT_BACKOFF_MS = [1000, 2000, 4000];

export class CircuitBreaker {
  constructor({ threshold = 3, cooldownMs = 30000, now = () => Date.now() } = {}) {
    this.threshold = threshold;
    this.cooldownMs = cooldownMs;
    this._now = now;
    this.failures = 0;
    this.openedAt = null;
  }

  get state() {
    if (this.openedAt === null) return 'closed';
    if (this._now() - this.openedAt >= this.cooldownMs) return 'half-open';
    return 'open';
  }

  recordSuccess() {
    this.failures = 0;
    this.openedAt = null;
  }

  recordFailure() {
    this.failures += 1;
    if (this.failures >= this.threshold) this.openedAt = this._now();
  }
}

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function normalize(res) {
  const text = await res.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* оставляем текст */
  }
  return { ok: res.ok, status: res.status, body };
}

export class HttpError extends Error {
  constructor(message, { status = null, retriable = false } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.retriable = retriable;
  }
}

// Возвращает {ok, status, body}. 4xx НЕ ретраится. 5xx/timeout → retry + circuit-breaker.
export async function requestWithReliability(url, opts = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    backoffMs = DEFAULT_BACKOFF_MS,
    breaker,
    fetchImpl = fetch,
    sleepImpl = defaultSleep,
    ...fetchOpts
  } = opts;

  if (breaker && breaker.state === 'open') {
    throw new HttpError('circuit-breaker is OPEN — request blocked', { retriable: false });
  }

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchImpl(url, { ...fetchOpts, signal: AbortSignal.timeout(timeoutMs) });
      if (res.status >= 400 && res.status < 500) {
        breaker?.recordSuccess(); // сервер доступен — не ретраим бизнес-ошибку
        return await normalize(res);
      }
      if (res.status >= 500) {
        lastErr = new HttpError(`server error ${res.status}`, { status: res.status, retriable: true });
        throw lastErr;
      }
      breaker?.recordSuccess();
      return await normalize(res);
    } catch (err) {
      lastErr = err;
      breaker?.recordFailure();
      if (breaker && breaker.state === 'open') {
        throw new HttpError('circuit-breaker opened after repeated failures', { retriable: false });
      }
      if (attempt < retries) {
        await sleepImpl(backoffMs[Math.min(attempt, backoffMs.length - 1)]);
      }
    }
  }
  throw lastErr ?? new HttpError('request failed', { retriable: false });
}
