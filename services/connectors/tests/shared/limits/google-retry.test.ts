import { describe, expect, it } from "vitest";
import { googleRetry } from "../../../src/shared/google/retry.js";

type Check = NonNullable<ReturnType<typeof googleRetry>["shouldRetry"]>;
// The shape of a gaxios error that `shouldRetry` reads: the request's method and attempt count, and a 429 response.
const limited = (method: string | undefined, attempt = 0) =>
  ({
    config: { ...(method && { method }), retryConfig: { currentRetryAttempt: attempt } },
    response: { status: 429, headers: new Headers(), data: {} },
  }) as unknown as Parameters<Check>[0];
const shouldRetry = googleRetry(3, 60).shouldRetry as Check;

describe("googleRetry.shouldRetry", () => {
  it.each(["POST", "PUT", "DELETE", "PATCH", "post"])("does not retry a %s 429", (method) => {
    expect(shouldRetry(limited(method))).toBe(false);
  });

  it.each(["GET", "get", undefined])("retries a %s 429", (method) => {
    expect(shouldRetry(limited(method))).toBe(true);
  });

  it("stops once 3 attempts are used", () => {
    expect(shouldRetry(limited("GET", 2))).toBe(true);
    expect(shouldRetry(limited("GET", 3))).toBe(false);
  });

  it.each([-1, 1.5, Number.NaN])("rejects retries %s itself with a RangeError, for callers that skip the connectors", (bad) => {
    expect(() => googleRetry(bad)).toThrow(RangeError);
  });
});
