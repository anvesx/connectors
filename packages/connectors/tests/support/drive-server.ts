import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export const DOC = "application/vnd.google-apps.document";
export type DFile = { id: string; name: string; mimeType: string; version: string; body: string; permissions?: object[]; readers?: string[] };
export type Change = { fileId: string; removed: boolean; trashed?: boolean };
export type DriveServer = {
  url: string;
  files: Map<string, DFile>;
  changes: Change[];
  seen: { path: string; authorization: string | undefined }[];
  close: () => Promise<void>;
};

const send = (res: ServerResponse, status: number, body: unknown) =>
  res
    .writeHead(status, { "content-type": typeof body === "string" ? "text/plain" : "application/json" })
    .end(typeof body === "string" ? body : JSON.stringify(body));
const fail = (res: ServerResponse, code: number, message: string) => send(res, code, { error: { code, message, errors: [{ message, domain: "global" }] } });

/**
 * A stateful local Google Drive v3 server: files.list (paged), files.get (metadata or alt=media), files.export,
 * permissions.list, changes.getStartPageToken and changes.list (paged). A bearer token is required (401 without),
 * `tokens` limits which are valid, a file's `readers` limits who may see it (403), a missing id is 404, id `boom` is 500.
 * Cursors are numeric offsets; `bad` or a non-number is 400. `cap` bounds every page, whatever pageSize asks for.
 */
export const startDrive = async (initial: DFile[], opts: { cap?: number; tokens?: string[] } = {}): Promise<DriveServer> => {
  const cap = opts.cap ?? 2;
  const files = new Map(initial.map((f) => [f.id, f]));
  const out: DriveServer = { url: "", files, changes: [], seen: [], close: () => Promise.resolve() };
  const page = <T>(all: T[], q: URLSearchParams, res: ServerResponse): { slice: T[]; end: number } | undefined => {
    const from = q.get("pageToken") === null ? 0 : Number(q.get("pageToken"));
    if (!Number.isInteger(from) || from < 0) return void fail(res, 400, "Invalid Value");
    const end = from + Math.min(Number(q.get("pageSize") ?? cap), cap);
    return { slice: all.slice(from, end), end };
  };
  const server = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const authorization = req.headers.authorization;
    out.seen.push({ path: u.pathname + u.search, authorization });
    const token = authorization?.replace(/^Bearer /, "");
    if (!token || (opts.tokens && !opts.tokens.includes(token))) return fail(res, 401, "Invalid Credentials");
    const route = u.pathname.replace(/^\/drive\/v3/, "");
    const q = u.searchParams;
    if (route === "/changes/startPageToken") return send(res, 200, { kind: "drive#startPageToken", startPageToken: String(out.changes.length) });
    if (route === "/changes") {
      const p = page(out.changes, q, res);
      if (!p) return;
      const changes = p.slice.map((c) => ({ kind: "drive#change", type: "file", fileId: c.fileId, removed: c.removed, file: { trashed: c.trashed ?? false } }));
      return send(
        res,
        200,
        p.end < out.changes.length ? { changes, nextPageToken: String(p.end) } : { changes, newStartPageToken: String(out.changes.length) },
      );
    }
    const visible = (f: DFile) => !f.readers || f.readers.includes(token);
    if (route === "/files") {
      const all = [...files.values()].filter((f) => visible(f) && (f.mimeType === DOC || f.mimeType.startsWith("text/")));
      const p = page(all, q, res);
      if (!p) return;
      const list = p.slice.map(({ body: _b, readers: _r, ...meta }) => ({ kind: "drive#file", modifiedTime: "2026-10-28T14:03:11.000Z", ...meta }));
      return send(res, 200, p.end < all.length ? { files: list, nextPageToken: String(p.end) } : { files: list });
    }
    const m = /^\/files\/([^/]+)(\/export|\/permissions)?$/.exec(route);
    const id = decodeURIComponent(m?.[1] ?? "");
    if (!m || id === "boom") return fail(res, id === "boom" ? 500 : 404, id === "boom" ? "Backend Error" : "Not Found");
    const f = files.get(id);
    if (!f) return fail(res, 404, `File not found: ${id}.`);
    if (!visible(f)) return fail(res, 403, "The user does not have sufficient permissions for this file.");
    if (m[2] === "/permissions") return send(res, 200, { kind: "drive#permissionList", permissions: f.permissions ?? [] });
    if (m[2] === "/export") return f.mimeType === DOC ? send(res, 200, f.body) : fail(res, 403, "Export only supports Docs Editors files.");
    if (q.get("alt") === "media") return send(res, 200, f.body);
    return send(res, 200, { kind: "drive#file", id: f.id, name: f.name, mimeType: f.mimeType, version: f.version });
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  out.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  out.close = () => new Promise((ok) => server.close(() => ok()));
  return out;
};
