/** What an upstream limit looks like to callers. `ConnectorErrorCode` belongs to connector-kit and is closed, so these have their own class. */
export type LimitCode = "RATE_LIMITED" | "PAGE_LIMIT";

export class UpstreamLimitError extends Error {
  readonly code: LimitCode;

  constructor(code: LimitCode, message: string) {
    super(message);
    this.name = "UpstreamLimitError";
    this.code = code;
  }
}

/** The page cap for one paginated walk: the caller's `maxPages`, else the connector's default. Anything but a whole number >= 1 is a bug in the caller. */
export const pageCap = (configured: number | undefined, fallback: number): number => {
  const cap = configured ?? fallback;
  if (!Number.isInteger(cap) || cap < 1) throw new RangeError("maxPages must be an integer of at least 1");
  return cap;
};

/** The retry budget for one request: the caller's `maxRetries`, else the default. Anything but a whole number >= 0 is a bug in the caller. */
export const retryCap = (configured: number | undefined, fallback: number): number => {
  const cap = configured ?? fallback;
  if (!Number.isInteger(cap) || cap < 0) throw new RangeError("maxRetries must be an integer of at least 0");
  return cap;
};

/** The longest `Retry-After`, in seconds, a connector sleeps through by default; a longer one fails at once with RATE_LIMITED. */
export const DEFAULT_MAX_WAIT_SECONDS = 60;

export const pageLimit = (what: string, maxPages: number): UpstreamLimitError =>
  new UpstreamLimitError("PAGE_LIMIT", `${what} has more than ${maxPages} pages; raise maxPages or narrow the sync`);

/** Google's reasons for a 403 that means "slow down" (`error.errors[0].reason`, domain `usageLimits`); any other 403 is a permission error. */
export const GOOGLE_QUOTA_REASONS: ReadonlySet<unknown> = new Set(["rateLimitExceeded", "userRateLimitExceeded"]);

/** True when a failed request means "slow down": 429, or a 403 that carries Retry-After, an exhausted GitHub quota or a Google quota reason (those 403s are not permission errors). */
export const isRateLimited = (error: unknown): boolean => {
  const e = error as {
    status?: unknown;
    response?: { status?: unknown; headers?: Record<string, unknown>; data?: { error?: { errors?: { reason?: unknown }[] } } };
  } | null;
  const status = Number(e?.status ?? e?.response?.status);
  if (status === 429) return true;
  const headers = e?.response?.headers ?? {};
  const reason = e?.response?.data?.error?.errors?.[0]?.reason;
  return status === 403 && (headers["retry-after"] !== undefined || headers["x-ratelimit-remaining"] === "0" || GOOGLE_QUOTA_REASONS.has(reason));
};
