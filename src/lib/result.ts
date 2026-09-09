/** Ошибки — значения. throw допустим только внутри колбэка транзакции, для отката. */
export type AppError = { code: string; message: string; details?: unknown };
export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });
export const fail = <T = never>(code: string, message: string, details?: unknown): Result<T> => ({
  ok: false,
  error: { code, message, details },
});

/** Единственное место, где код ошибки превращается в HTTP-статус. */
export const HTTP_STATUS: Record<string, number> = {
  bad_request: 400,
  validation_failed: 400,
  forbidden: 403,
  not_found: 404,
  no_stock: 409,
  slot_full: 409,
  invalid_transition: 409,
  write_off_exceeds_stock: 409,
  internal: 500,
};
