/**
 * Minimal document-store port used by services. Production uses Firestore
 * (firestore-store.ts); unit tests use the in-memory implementation
 * (memory-store.ts) so tenancy checks are tested without emulators.
 *
 * Semantics: `update` merges top-level fields only (nested maps are replaced),
 * which matches Firestore `update()` when callers pass whole nested objects.
 */
export type DocData = Record<string, unknown>;
export type Doc<T> = T & { id: string };
export type GroupDoc<T> = Doc<T> & { path: string };

export interface ListQuery {
  where?: Array<[field: string, op: "==", value: unknown]>;
  orderBy?: { field: string; direction?: "asc" | "desc" };
  limit?: number;
}

export interface Tx {
  get<T>(path: string): Promise<Doc<T> | null>;
  set(path: string, data: DocData): void;
  create(path: string, data: DocData): void;
  update(path: string, data: DocData): void;
}

export interface DocStore {
  newId(): string;
  get<T>(path: string): Promise<Doc<T> | null>;
  set(path: string, data: DocData): Promise<void>;
  /** Fails with an error if the document already exists. */
  create(path: string, data: DocData): Promise<void>;
  /** Fails with an error if the document does not exist. */
  update(path: string, data: DocData): Promise<void>;
  delete(path: string): Promise<void>;
  list<T>(collectionPath: string, query?: ListQuery): Promise<Doc<T>[]>;
  /** Collection-group query across every collection with this id. */
  listGroup<T>(collectionId: string, query?: ListQuery): Promise<GroupDoc<T>[]>;
  /** Reads first, then writes; writes are applied atomically at the end. */
  runTransaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R>;
}
