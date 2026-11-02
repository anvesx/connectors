import type { Connector } from "@brain/connector-kit";
import type { Zone } from "@brain/core-types";

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
};
