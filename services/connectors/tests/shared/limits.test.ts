import { describe, expect, it } from "vitest";
import { createDriveConnector, createGithubConnector, createGmailConnector, createSlackConnector } from "../../src/index.js";
import { isRateLimited, pageCap, retryCap } from "../../src/shared/limits.js";

describe("pageCap", () => {
  it("uses the configured value, else the fallback", () => {
    expect(pageCap(7, 30)).toBe(7);
    expect(pageCap(1, 30)).toBe(1);
    expect(pageCap(undefined, 30)).toBe(30);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "3"])("rejects maxPages %s with a RangeError", (bad) => {
    expect(() => pageCap(bad as number, 30)).toThrow(RangeError);
    expect(() => pageCap(bad as number, 30)).toThrow("maxPages must be an integer of at least 1");
  });

  it("is checked when a connector is created", () => {
    const base = { id: "x", listToken: "t", maxPages: 0 };
    expect(() => createSlackConnector(base)).toThrow(RangeError);
    expect(() => createDriveConnector(base)).toThrow(RangeError);
    expect(() => createGmailConnector(base)).toThrow(RangeError);
    expect(() => createGithubConnector({ ...base, owner: "a", repo: "b" })).toThrow(RangeError);
  });
});

describe("retryCap", () => {
  it("uses the configured value (0 is valid, it means no retries), else the fallback", () => {
    expect([retryCap(5, 3), retryCap(0, 3), retryCap(undefined, 3)]).toEqual([5, 0, 3]);
  });

  it.each([-1, 1.5, Number.NaN, "3"])("rejects maxRetries %s with a RangeError, when the connector is created", (bad) => {
    expect(() => retryCap(bad as number, 3)).toThrow("maxRetries must be an integer of at least 0");
    expect(() => createGithubConnector({ id: "x", listToken: "t", owner: "a", repo: "b", maxRetries: bad as number })).toThrow(RangeError);
    expect(() => createSlackConnector({ id: "x", listToken: "t", retries: bad as number })).toThrow(RangeError);
    expect(() => createDriveConnector({ id: "x", listToken: "t", retries: bad as number })).toThrow(RangeError);
    expect(() => createGmailConnector({ id: "x", listToken: "t", retries: bad as number })).toThrow(RangeError);
  });
});

describe("isRateLimited", () => {
  const res = (status: number, headers: Record<string, string> = {}, data?: unknown) => ({ response: { status, headers, data } });
  const reason = (r: string) => ({ error: { errors: [{ domain: "usageLimits", reason: r }] } });

  it("is true for 429, whether the status sits on the error or its response", () => {
    expect(isRateLimited({ status: 429 })).toBe(true);
    expect(isRateLimited(res(429))).toBe(true);
  });

  it("is true for a 403 with Retry-After, an exhausted quota, or a Google quota reason", () => {
    expect(isRateLimited(res(403, { "retry-after": "5" }))).toBe(true);
    expect(isRateLimited(res(403, { "x-ratelimit-remaining": "0" }))).toBe(true);
    expect(isRateLimited(res(403, {}, reason("rateLimitExceeded")))).toBe(true);
    expect(isRateLimited(res(403, {}, reason("userRateLimitExceeded")))).toBe(true);
  });

  it("is false for a plain 403, a 403 with quota left, other reasons, other statuses and non-errors", () => {
    expect(isRateLimited(res(403))).toBe(false);
    expect(isRateLimited(res(403, { "x-ratelimit-remaining": "4999" }))).toBe(false);
    expect(isRateLimited(res(403, {}, reason("forbidden")))).toBe(false);
    expect(isRateLimited(res(404, { "retry-after": "5" }))).toBe(false);
    expect(isRateLimited(res(500, {}, reason("rateLimitExceeded")))).toBe(false);
    expect(isRateLimited(null)).toBe(false);
    expect(isRateLimited(new Error("boom"))).toBe(false);
  });
});
