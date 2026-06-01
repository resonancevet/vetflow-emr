"use client";

const DB_NAME = "vetroamer-offline";
const DB_VERSION = 3;
const OUTBOX_STORE = "outbox";
const ATTACHMENTS_STORE = "attachments";
const FIELD_NOTES_STORE = "fieldNotes";
const SCHEDULE_STORE = "scheduleCache";
const PATIENT_STORE = "patientCache";

export const OFFLINE_OUTBOX_CHANGED = "vetroamer:offline-outbox-changed";

export type OfflineOutboxItem = {
  id: string;
  kind: "trpc-mutation" | "upload";
  target: string;
  payload: unknown;
  createdAt: string;
  attempts: number;
  lastError?: string;
  attachmentIds?: string[];
};

export type OfflineAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  blob: Blob;
  createdAt: string;
};

function assertBrowser() {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    throw new Error("Offline storage is not available in this environment.");
  }
}

function openOfflineDb(): Promise<IDBDatabase> {
  assertBrowser();

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const outbox = db.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
        outbox.createIndex("createdAt", "createdAt");
        outbox.createIndex("kind", "kind");
      }

      if (!db.objectStoreNames.contains(ATTACHMENTS_STORE)) {
        const attachments = db.createObjectStore(ATTACHMENTS_STORE, {
          keyPath: "id",
        });
        attachments.createIndex("createdAt", "createdAt");
      }

      if (!db.objectStoreNames.contains(FIELD_NOTES_STORE)) {
        const fieldNotes = db.createObjectStore(FIELD_NOTES_STORE, {
          keyPath: "id",
        });
        fieldNotes.createIndex("updatedAt", "updatedAt");
        fieldNotes.createIndex("attachedAt", "attachedAt");
      }

      if (!db.objectStoreNames.contains(SCHEDULE_STORE)) {
        const schedule = db.createObjectStore(SCHEDULE_STORE, {
          keyPath: "date",
        });
        schedule.createIndex("cachedAt", "cachedAt");
      }

      if (!db.objectStoreNames.contains(PATIENT_STORE)) {
        const patient = db.createObjectStore(PATIENT_STORE, {
          keyPath: "patientId",
        });
        patient.createIndex("cachedAt", "cachedAt");
      }
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> {
  return openOfflineDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = operation(store);

        transaction.oncomplete = () => {
          db.close();
          resolve(request ? request.result : undefined);
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
      })
  );
}

function createId(prefix: string) {
  if ("crypto" in window && "randomUUID" in window.crypto) {
    return `${prefix}_${window.crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function notifyOutboxChanged() {
  window.dispatchEvent(new Event(OFFLINE_OUTBOX_CHANGED));
}

export async function enqueueOfflineMutation(input: {
  target: string;
  payload: unknown;
  attachmentIds?: string[];
}): Promise<OfflineOutboxItem> {
  const item: OfflineOutboxItem = {
    id: createId("outbox"),
    kind: "trpc-mutation",
    target: input.target,
    payload: input.payload,
    attachmentIds: input.attachmentIds,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };

  await withStore(OUTBOX_STORE, "readwrite", (store) => store.add(item));
  notifyOutboxChanged();
  return item;
}

export async function enqueueOfflineUpload(input: {
  target: string;
  payload: unknown;
  files: File[];
}): Promise<OfflineOutboxItem> {
  const attachmentIds: string[] = [];

  for (const file of input.files) {
    const attachment: OfflineAttachment = {
      id: createId("attachment"),
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      blob: file,
      createdAt: new Date().toISOString(),
    };
    attachmentIds.push(attachment.id);
    await withStore(ATTACHMENTS_STORE, "readwrite", (store) =>
      store.add(attachment)
    );
  }

  const item: OfflineOutboxItem = {
    id: createId("outbox"),
    kind: "upload",
    target: input.target,
    payload: input.payload,
    attachmentIds,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };

  await withStore(OUTBOX_STORE, "readwrite", (store) => store.add(item));
  notifyOutboxChanged();
  return item;
}

export async function listOfflineOutbox(): Promise<OfflineOutboxItem[]> {
  const items = await withStore<OfflineOutboxItem[]>(
    OUTBOX_STORE,
    "readonly",
    (store) => store.getAll()
  );

  return (items ?? []).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export async function countOfflineOutbox(): Promise<number> {
  const count = await withStore<number>(OUTBOX_STORE, "readonly", (store) =>
    store.count()
  );
  return count ?? 0;
}

export async function getOfflineAttachment(
  id: string
): Promise<OfflineAttachment | undefined> {
  return withStore<OfflineAttachment>(ATTACHMENTS_STORE, "readonly", (store) =>
    store.get(id)
  );
}

export async function removeOfflineOutboxItem(item: OfflineOutboxItem) {
  await withStore(OUTBOX_STORE, "readwrite", (store) => store.delete(item.id));

  for (const attachmentId of item.attachmentIds ?? []) {
    await withStore(ATTACHMENTS_STORE, "readwrite", (store) =>
      store.delete(attachmentId)
    );
  }

  notifyOutboxChanged();
}

export async function markOfflineOutboxAttempt(
  item: OfflineOutboxItem,
  error: string
) {
  await withStore(OUTBOX_STORE, "readwrite", (store) =>
    store.put({
      ...item,
      attempts: item.attempts + 1,
      lastError: error,
    })
  );
  notifyOutboxChanged();
}
