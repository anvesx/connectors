import type { Connector } from "@anvesx/connector-kit";
import type { Zone } from "@anvesx/core-types";

export type ChangeEvent = { address: string; kind: "upsert" | "delete" };
export type ChangeSet = { events: ChangeEvent[]; next: string };

/** A `Connector` that checks the caller's own token at the source and can report changes since a cursor. */
export interface SourceConnector extends Connector {
  enforcesUserToken: true;
  /** Without a cursor, returns no events and a baseline cursor. An unusable cursor throws `BAD_CURSOR`. */
  changes(query: { token: string; cursor?: string }): Promise<ChangeSet>;
}

export type CommonConfig = {
  id: string;
  /** Token used by `list`, which has no per-call token in the `Connector` contract (an indexing identity). */
  listToken: string;
  zone?: Zone;
  /** Most pages one paginated walk may fetch before it stops; each connector documents its default and the items that implies. */
  maxPages?: number;
  /** Longest `Retry-After`, in seconds, to sleep through before retrying a rate limit; a longer one fails at once with `RATE_LIMITED`. Default 60. */
  maxWaitSeconds?: number;
};
