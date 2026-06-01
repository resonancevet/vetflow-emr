"use client";

const DB_NAME = "vetroamer-offline";
const DB_VERSION = 3;

const OUTBOX_STORE = "outbox";
const ATTACHMENTS_STORE = "attachments";
const FIELD_NOTES_STORE = "fieldNotes";
const SCHEDULE_STORE = "scheduleCache";
const PATIENT_STORE = "patientCache";

export const OFFLINE_CACHE_CHANGED = "vetroamer:offline-cache-changed";

export type CachedAppointment = {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  patientName: string | null;
  patientSpecies: string | null;
  patientId: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientId: string | null;
  doctorName: string | null;
  doctorId: string | null;
  typeName: string | null;
  typeColor: string | null;
  typeDuration: number | null;
  roomName: string | null;
};

export type CachedSchedule = {
  /** YYYY-MM-DD; used as the IndexedDB key. */
  date: string;
  appointments: CachedAppointment[];
  cachedAt: string;
};

export type CachedPatientSnapshot = {
  patientId: string;
  patient: Record<string, unknown> & {
    id: string;
    name: string;
    species: string | null;
    breed: string | null;
    sex: string | null;
    dob: string | null;
    color: string | null;
    microchipNumber: string | null;
    photoUrl: string | null;
    status: string | null;
    clientId: string | null;
    clientFirstName: string | null;
    clientLastName: string | null;
    clientEmail: string | null;
    clientPhone: string | null;
  };
  weights: Record<string, unknown>[];
  allergies: Record<string, unknown>[];
  problems: Record<string, unknown>[];
  vaccinations: Record<string, unknown>[];
  prescriptions: Record<string, unknown>[];
  soapNotes: Record<string, unknown>[];
  labResults: Record<string, unknown>[];
  procedures: Record<string, unknown>[];
  alerts: Record<string, unknown>[];
  cachedAt: string;
};

function assertBrowser() {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    throw new Error("Offline cache is not available in this environment.");
  }
}

function ensureStores(db: IDBDatabase) {
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
    const schedule = db.createObjectStore(SCHEDULE_STORE, { keyPath: "date" });
    schedule.createIndex("cachedAt", "cachedAt");
  }
  if (!db.objectStoreNames.contains(PATIENT_STORE)) {
    const patient = db.createObjectStore(PATIENT_STORE, {
      keyPath: "patientId",
    });
    patient.createIndex("cachedAt", "cachedAt");
  }
}

function openCacheDb(): Promise<IDBDatabase> {
  assertBrowser();

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      ensureStores(request.result);
    };
    request.onblocked = () => {
      reject(
        new Error(
          "Offline chart storage is busy. Close other VetRoamer tabs, reopen Safari, then retry."
        )
      );
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> {
  return openCacheDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
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

function notifyChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OFFLINE_CACHE_CHANGED));
  }
}

// --- Schedule helpers --------------------------------------------------------

export async function saveCachedSchedule(
  date: string,
  appointments: CachedAppointment[]
): Promise<CachedSchedule> {
  const record: CachedSchedule = {
    date,
    appointments,
    cachedAt: new Date().toISOString(),
  };
  await withStore(SCHEDULE_STORE, "readwrite", (store) => store.put(record));
  notifyChanged();
  return record;
}

export async function getCachedSchedule(
  date: string
): Promise<CachedSchedule | undefined> {
  return withStore<CachedSchedule>(SCHEDULE_STORE, "readonly", (store) =>
    store.get(date)
  );
}

export async function listCachedSchedules(): Promise<CachedSchedule[]> {
  const rows = await withStore<CachedSchedule[]>(
    SCHEDULE_STORE,
    "readonly",
    (store) => store.getAll()
  );
  return (rows ?? []).sort((a, b) => (a.date < b.date ? 1 : -1));
}

// --- Patient snapshot helpers -----------------------------------------------

export async function saveCachedPatientSnapshot(
  snapshot: Omit<CachedPatientSnapshot, "cachedAt">
): Promise<CachedPatientSnapshot> {
  const record: CachedPatientSnapshot = {
    ...snapshot,
    cachedAt: new Date().toISOString(),
  };
  await withStore(PATIENT_STORE, "readwrite", (store) => store.put(record));
  notifyChanged();
  return record;
}

export async function getCachedPatientSnapshot(
  patientId: string
): Promise<CachedPatientSnapshot | undefined> {
  return withStore<CachedPatientSnapshot>(PATIENT_STORE, "readonly", (store) =>
    store.get(patientId)
  );
}

export async function listCachedPatientSnapshots(): Promise<
  CachedPatientSnapshot[]
> {
  const rows = await withStore<CachedPatientSnapshot[]>(
    PATIENT_STORE,
    "readonly",
    (store) => store.getAll()
  );
  return (rows ?? []).sort(
    (a, b) => new Date(b.cachedAt).getTime() - new Date(a.cachedAt).getTime()
  );
}

export async function removeCachedPatientSnapshot(patientId: string) {
  await withStore(PATIENT_STORE, "readwrite", (store) =>
    store.delete(patientId)
  );
  notifyChanged();
}

export async function clearOfflineSnapshots(): Promise<void> {
  await Promise.all([
    withStore(SCHEDULE_STORE, "readwrite", (store) => store.clear()),
    withStore(PATIENT_STORE, "readwrite", (store) => store.clear()),
  ]);
  notifyChanged();
}
