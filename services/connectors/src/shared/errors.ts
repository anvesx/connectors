import { ConnectorError } from "@anvesx/connector-kit";
import { isRateLimited, UpstreamLimitError } from "./limits.js";

/** HTTP status from an Octokit `RequestError` (`status`) or a Gaxios error (`status`, `response.status`, numeric `code`). */
export const statusOf = (error: unknown): number | undefined => {
  const e = error as { status?: unknown; code?: unknown; response?: { status?: unknown } } | null;
  for (const candidate of [e?.status, e?.response?.status, e?.code]) {
    const n = Number(candidate);
    if (Number.isInteger(n) && n >= 100 && n < 600) return n;
  }
  return undefined;
};

/** A rate limit that outlived the client library's retries becomes RATE_LIMITED, 404 NOT_FOUND and 401/403 FORBIDDEN; anything else passes through. */
export const toConnectorError = (error: unknown, what: string): unknown => {
  if (isRateLimited(error)) return new UpstreamLimitError("RATE_LIMITED", `Rate limited: ${what}`);
  const status = statusOf(error);
  if (status === 404) return new ConnectorError("NOT_FOUND", `Not found: ${what}`);
  if (status === 401 || status === 403) return new ConnectorError("FORBIDDEN", `Forbidden: ${what}`);
  return error;
};

export const guarded = async <T>(what: string, run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    throw toConnectorError(error, what);
  }
};

export const badCursor = (): ConnectorError => new ConnectorError("BAD_CURSOR", "Invalid cursor");
