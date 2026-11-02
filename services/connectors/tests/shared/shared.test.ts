import { describe, expect, it } from "vitest";
import { buildAcl } from "../../src/shared/acl.js";
import { statusOf, toConnectorError } from "../../src/shared/errors.js";

describe("buildAcl", () => {
  it("sorts, de-duplicates and versions deterministically", () => {
    const a = buildAcl(["b", "a", "a"], ["g"]);
    expect(a.allowUsers).toEqual(["a", "b"]);
    expect(buildAcl(["a", "b"], ["g"]).version).toBe(a.version);
    expect(buildAcl(["a"], ["g"]).version).not.toBe(a.version);
  });
});

describe("error mapping", () => {
  it("maps 404 to NOT_FOUND and 401/403 to FORBIDDEN, passes others through", () => {
    expect(toConnectorError({ status: 404 }, "x")).toMatchObject({ code: "NOT_FOUND" });
    expect(toConnectorError({ response: { status: 403 } }, "x")).toMatchObject({ code: "FORBIDDEN" });
    expect(toConnectorError({ code: "401" }, "x")).toMatchObject({ code: "FORBIDDEN" });
    const other = new Error("boom");
    expect(toConnectorError(other, "x")).toBe(other);
    expect(statusOf({ code: "ECONNRESET" })).toBeUndefined();
  });
});
