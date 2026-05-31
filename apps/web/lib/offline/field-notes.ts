"use client";

const DB_NAME = "vetroamer-offline";
const DB_VERSION = 2;
const OUTBOX_STORE = "outbox";
const ATTACHMENTS_STORE = "attachments";
const FIELD_NOTES_STORE = "fieldNotes";

export const OFFLINE_FIELD_NOTES_CHANGED = "vetroamer:offline-field-notes-changed";

export type OfflineFieldNote = {
  id: string;
  // Patient name typed offline. Stored in `title` for backward compatibility
  // with notes created before the SOAP-shaped form.
  title: string;
  ownerLastName?: string;
  visitAt?: string;
  // SOAP-shaped sections. Older notes only have `body`; new notes use the
  // four explicit fields. Both are kept so existing local notes still load.
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  body?: string;
  createdAt: string;
  updatedAt: string;
  attachedAt?: string;
  attachedPatientId?: string;
  attachedPatientName?: string;
  soapNoteId?: string;
};

function assertBrowser() {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    throw new Error("Offline note storage is not available in this environment.");
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
        const store = db.createObjectStore(FIELD_NOTES_STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
        store.createIndex("attachedAt", "attachedAt");
      }
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> {
  return openOfflineDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(FIELD_NOTES_STORE, mode);
        const store = tx.objectStore(FIELD_NOTES_STORE);
        const request = operation(store);

        tx.oncomplete = () => {
          db.close();
          resolve(request ? request.result : undefined);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      })
  );
}

function createId() {
  if ("crypto" in window && "randomUUID" in window.crypto) {
    return `note_${window.crypto.randomUUID()}`;
  }
  return `note_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function notifyChanged() {
  window.dispatchEvent(new Event(OFFLINE_FIELD_NOTES_CHANGED));
}

export async function listOfflineFieldNotes(): Promise<OfflineFieldNote[]> {
  const rows = await withStore<OfflineFieldNote[]>("readonly", (store) => store.getAll());
  return (rows ?? []).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export type OfflineFieldNoteInput = {
  title?: string;
  ownerLastName?: string;
  visitAt?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
};

function hasContent(input: OfflineFieldNoteInput): boolean {
  return Boolean(
    input.subjective?.trim() ||
      input.objective?.trim() ||
      input.assessment?.trim() ||
      input.plan?.trim()
  );
}

export async function createOfflineFieldNote(
  input: OfflineFieldNoteInput
): Promise<OfflineFieldNote> {
  const now = new Date().toISOString();
  const note: OfflineFieldNote = {
    id: createId(),
    title: input.title?.trim() || "Field note",
    ownerLastName: input.ownerLastName?.trim() || undefined,
    visitAt: input.visitAt,
    subjective: input.subjective ?? "",
    objective: input.objective ?? "",
    assessment: input.assessment ?? "",
    plan: input.plan ?? "",
    createdAt: now,
    updatedAt: now,
  };

  if (!hasContent(input)) {
    throw new Error(
      "Add text in subjective, objective, assessment, or plan before saving."
    );
  }

  await withStore("readwrite", (store) => store.add(note));
  notifyChanged();
  return note;
}

export async function updateOfflineFieldNote(
  id: string,
  patch: OfflineFieldNoteInput
): Promise<OfflineFieldNote> {
  const existing = await withStore<OfflineFieldNote>("readonly", (store) => store.get(id));
  if (!existing) {
    throw new Error("Offline field note not found");
  }

  const next: OfflineFieldNote = {
    ...existing,
    title:
      patch.title !== undefined
        ? patch.title.trim() || "Field note"
        : existing.title,
    ownerLastName:
      patch.ownerLastName !== undefined
        ? patch.ownerLastName.trim() || undefined
        : existing.ownerLastName,
    visitAt: patch.visitAt !== undefined ? patch.visitAt : existing.visitAt,
    subjective:
      patch.subjective !== undefined
        ? patch.subjective
        : existing.subjective ?? existing.body ?? "",
    objective:
      patch.objective !== undefined ? patch.objective : existing.objective ?? "",
    assessment:
      patch.assessment !== undefined
        ? patch.assessment
        : existing.assessment ?? "",
    plan: patch.plan !== undefined ? patch.plan : existing.plan ?? "",
    updatedAt: new Date().toISOString(),
  };

  await withStore("readwrite", (store) => store.put(next));
  notifyChanged();
  return next;
}

export async function deleteOfflineFieldNote(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
  notifyChanged();
}

export async function markOfflineFieldNoteAttached(input: {
  id: string;
  patientId: string;
  patientName: string;
  soapNoteId: string;
}): Promise<OfflineFieldNote> {
  const existing = await withStore<OfflineFieldNote>("readonly", (store) =>
    store.get(input.id)
  );
  if (!existing) {
    throw new Error("Offline field note not found");
  }

  const next: OfflineFieldNote = {
    ...existing,
    attachedAt: new Date().toISOString(),
    attachedPatientId: input.patientId,
    attachedPatientName: input.patientName,
    soapNoteId: input.soapNoteId,
    updatedAt: new Date().toISOString(),
  };

  await withStore("readwrite", (store) => store.put(next));
  notifyChanged();
  return next;
}
