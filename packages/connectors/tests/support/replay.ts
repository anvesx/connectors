import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

export const fixture = <T = unknown>(name: string): T => JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), "utf8")) as T;

export type Reply = { status: number; body: unknown };
export type Route = Reply | ((url: URL) => Reply);
export type Replay = { url: string; seen: { path: string; authorization: string | undefined }[]; close: () => Promise<void> };

/** A real local HTTP server that answers each pathname with recorded fixture JSON, so the vendor SDKs run their real request path. */
export const startReplay = async (routes: Record<string, Route>): Promise<Replay> => {
  const seen: Replay["seen"] = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    seen.push({ path: url.pathname + url.search, authorization: req.headers.authorization });
    const route = routes[decodeURIComponent(url.pathname)];
    const reply: Reply = route === undefined ? { status: 404, body: { message: "Not Found" } } : typeof route === "function" ? route(url) : route;
    res.writeHead(reply.status, { "content-type": typeof reply.body === "string" ? "text/plain" : "application/json" });
    res.end(typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { url, seen, close: () => new Promise((resolve) => server.close(() => resolve())) };
};
