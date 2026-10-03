import type { Firestore, Query } from "firebase-admin/firestore";
import type { Doc, DocData, DocStore, GroupDoc, ListQuery, Tx } from "./doc-store.js";

/** Firestore implementation of the DocStore port (firebase-admin). */
export class FirestoreStore implements DocStore {
  constructor(private readonly db: Firestore) {}

  newId(): string {
    return this.db.collection("_").doc().id;
  }

  async get<T>(path: string): Promise<Doc<T> | null> {
    const snap = await this.db.doc(path).get();
    return snap.exists ? ({ ...(snap.data() as T), id: snap.id } as Doc<T>) : null;
  }

  async set(path: string, data: DocData): Promise<void> {
    await this.db.doc(path).set(data);
  }

  async create(path: string, data: DocData): Promise<void> {
    await this.db.doc(path).create(data);
  }

  async update(path: string, data: DocData): Promise<void> {
    await this.db.doc(path).update(data);
  }

  async delete(path: string): Promise<void> {
    await this.db.doc(path).delete();
  }

  async list<T>(collectionPath: string, query?: ListQuery): Promise<Doc<T>[]> {
    const snap = await applyQuery(this.db.collection(collectionPath), query).get();
    return snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }) as Doc<T>);
  }

  async listGroup<T>(collectionId: string, query?: ListQuery): Promise<GroupDoc<T>[]> {
    const snap = await applyQuery(this.db.collectionGroup(collectionId), query).get();
    return snap.docs.map((d) => ({ ...(d.data() as T), id: d.id, path: d.ref.path }) as GroupDoc<T>);
  }

  async runTransaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
    return this.db.runTransaction(async (t) => {
      const tx: Tx = {
        get: async <T>(path: string) => {
          const snap = await t.get(this.db.doc(path));
          return snap.exists ? ({ ...(snap.data() as T), id: snap.id } as Doc<T>) : null;
        },
        set: (path, data) => void t.set(this.db.doc(path), data),
        create: (path, data) => void t.create(this.db.doc(path), data),
        update: (path, data) => void t.update(this.db.doc(path), data),
      };
      return fn(tx);
    });
  }
}

function applyQuery(base: Query, query?: ListQuery): Query {
  let q = base;
  for (const [field, op, value] of query?.where ?? []) q = q.where(field, op, value);
  if (query?.orderBy) q = q.orderBy(query.orderBy.field, query.orderBy.direction ?? "asc");
  if (query?.limit !== undefined) q = q.limit(query.limit);
  return q;
}
