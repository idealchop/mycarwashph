import { randomUUID } from "node:crypto";
import type { Doc, DocData, DocStore, GroupDoc, ListQuery, Tx } from "./doc-store.js";

/** In-memory DocStore for unit tests and local experiments. Not for production. */
export class MemoryStore implements DocStore {
  private readonly docs = new Map<string, DocData>();

  newId(): string {
    return randomUUID().replace(/-/g, "").slice(0, 20);
  }

  async get<T>(path: string): Promise<Doc<T> | null> {
    return this.read<T>(path);
  }

  async set(path: string, data: DocData): Promise<void> {
    this.docs.set(path, clone(data));
  }

  async create(path: string, data: DocData): Promise<void> {
    if (this.docs.has(path)) throw new Error(`ALREADY_EXISTS: ${path}`);
    this.docs.set(path, clone(data));
  }

  async update(path: string, data: DocData): Promise<void> {
    const existing = this.docs.get(path);
    if (!existing) throw new Error(`NOT_FOUND: ${path}`);
    this.docs.set(path, { ...existing, ...clone(data) });
  }

  async delete(path: string): Promise<void> {
    this.docs.delete(path);
  }

  async list<T>(collectionPath: string, query?: ListQuery): Promise<Doc<T>[]> {
    const depth = collectionPath.split("/").length + 1;
    const rows = [...this.docs.keys()]
      .filter((p) => p.startsWith(`${collectionPath}/`) && p.split("/").length === depth)
      .map((p) => this.read<T>(p)!);
    return applyQuery(rows, query);
  }

  async listGroup<T>(collectionId: string, query?: ListQuery): Promise<GroupDoc<T>[]> {
    const rows = [...this.docs.keys()]
      .filter((p) => {
        const parts = p.split("/");
        return parts.length % 2 === 0 && parts[parts.length - 2] === collectionId;
      })
      .map((p) => ({ ...this.read<T>(p)!, path: p }));
    return applyQuery(rows, query);
  }

  async runTransaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
    const writes: Array<() => void> = [];
    const tx: Tx = {
      get: async <T>(path: string) => this.read<T>(path),
      set: (path, data) => void writes.push(() => this.docs.set(path, clone(data))),
      create: (path, data) =>
        void writes.push(() => {
          if (this.docs.has(path)) throw new Error(`ALREADY_EXISTS: ${path}`);
          this.docs.set(path, clone(data));
        }),
      update: (path, data) =>
        void writes.push(() => {
          const existing = this.docs.get(path);
          if (!existing) throw new Error(`NOT_FOUND: ${path}`);
          this.docs.set(path, { ...existing, ...clone(data) });
        }),
    };
    const result = await fn(tx);
    writes.forEach((w) => w());
    return result;
  }

  /** Test helper: raw dump of all paths. */
  paths(): string[] {
    return [...this.docs.keys()].sort();
  }

  private read<T>(path: string): Doc<T> | null {
    const data = this.docs.get(path);
    if (!data) return null;
    const id = path.split("/").pop()!;
    return { ...(clone(data) as T), id };
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function applyQuery<R extends { id: string }>(rows: R[], query?: ListQuery): R[] {
  let out = rows;
  for (const [field, , value] of query?.where ?? []) {
    out = out.filter((r) => (r as Record<string, unknown>)[field] === value);
  }
  if (query?.orderBy) {
    const { field, direction = "asc" } = query.orderBy;
    const sign = direction === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      const av = (a as Record<string, unknown>)[field] as string | number;
      const bv = (b as Record<string, unknown>)[field] as string | number;
      return av === bv ? 0 : av > bv ? sign : -sign;
    });
  }
  if (query?.limit !== undefined) out = out.slice(0, query.limit);
  return out;
}
