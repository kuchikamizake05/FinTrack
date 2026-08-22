import type { TransactionStatus, TransactionType } from "./finance";

const DATABASE_NAME = "fintrack-offline-v1";
const STORE_NAME = "transaction-operations";
const MAX_OPERATIONS = 100;
const MAX_MERCHANT_LENGTH = 500;
const MAX_CATEGORY_LENGTH = 120;
const MAX_NOTE_LENGTH = 2_000;

export type OfflineTransactionPayload = {
  id?: string;
  date?: string;
  type?: TransactionType;
  merchant?: string | null;
  category?: string;
  amount?: number;
  note?: string | null;
  account_id?: string;
  source?: "manual";
  status?: Extract<TransactionStatus, "deleted" | "needs_review">;
};

export type QueuedTransactionOperation = {
  opId: string;
  userId: string;
  kind: "create" | "edit" | "soft-delete";
  transactionId: string;
  payload: OfflineTransactionPayload;
  baseUpdatedAt: string | null;
  createdAt: string;
  attempts: number;
  state: "pending" | "conflict";
  lastError: string | null;
};

function storageUnavailable() {
  return typeof indexedDB === "undefined";
}

function openDatabase() {
  if (storageUnavailable()) return Promise.reject(new Error("Penyimpanan perangkat tidak tersedia."));
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE_NAME, { keyPath: "opId" });
      store.createIndex("userId", "userId", { unique: false });
      store.createIndex("createdAt", "createdAt", { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Penyimpanan perangkat tidak tersedia."));
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Penyimpanan perangkat gagal."));
  });
}

function validateText(value: unknown, maxLength: number) {
  return value === undefined || value === null || (typeof value === "string" && value.length <= maxLength);
}

export function validateQueuedTransactionOperation(operation: QueuedTransactionOperation) {
  if (!operation.opId || !operation.userId || !operation.transactionId || !operation.createdAt) return false;
  if (!["create", "edit", "soft-delete"].includes(operation.kind)) return false;
  if (operation.state !== "pending" && operation.state !== "conflict") return false;
  if (!Number.isInteger(operation.attempts) || operation.attempts < 0) return false;
  const payload = operation.payload;
  if (payload.source !== undefined && payload.source !== "manual") return false;
  if (!validateText(payload.merchant, MAX_MERCHANT_LENGTH) || !validateText(payload.category, MAX_CATEGORY_LENGTH) || !validateText(payload.note, MAX_NOTE_LENGTH)) return false;
  if (operation.kind === "soft-delete") return payload.status === "deleted";
  return Boolean(
    payload.id === undefined || payload.id === operation.transactionId,
  ) && /^\d{4}-\d{2}-\d{2}$/.test(payload.date ?? "")
    && (payload.type === "income" || payload.type === "expense")
    && Boolean(payload.category?.trim())
    && Boolean(payload.account_id)
    && Number.isFinite(payload.amount)
    && Number(payload.amount) > 0;
}

export async function listQueuedTransactionOperations(userId: string) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const operations = await requestResult(transaction.objectStore(STORE_NAME).index("userId").getAll(userId)) as QueuedTransactionOperation[];
    return operations.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  } finally {
    database.close();
  }
}

export async function queueTransactionOperation(operation: QueuedTransactionOperation) {
  if (!validateQueuedTransactionOperation(operation)) throw new Error("Perubahan offline tidak valid.");
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const current = await requestResult(store.index("userId").count(operation.userId));
    if (current >= MAX_OPERATIONS) throw new Error("Antrean offline perangkat sudah penuh.");
    await requestResult(store.put(operation));
  } finally {
    database.close();
  }
}

export async function removeQueuedTransactionOperation(opId: string) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    await requestResult(transaction.objectStore(STORE_NAME).delete(opId));
  } finally {
    database.close();
  }
}

export async function updateQueuedTransactionOperation(operation: QueuedTransactionOperation) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    await requestResult(transaction.objectStore(STORE_NAME).put(operation));
  } finally {
    database.close();
  }
}

export type QueueOverlayTransaction<T extends { id: string; status: TransactionStatus }> = T & { syncPending?: boolean };

export function projectQueuedTransactionOperations<T extends { id: string; status: TransactionStatus }>(transactions: readonly T[], operations: readonly QueuedTransactionOperation[]) {
  const projected = new Map(transactions.map((transaction) => [transaction.id, { ...transaction } as QueueOverlayTransaction<T>]));
  for (const operation of [...operations].filter((item) => item.state === "pending").sort((left, right) => left.createdAt.localeCompare(right.createdAt))) {
    const existing = projected.get(operation.transactionId);
    if (operation.kind === "create") {
      if (existing) continue;
      projected.set(operation.transactionId, {
        id: operation.transactionId,
        ...operation.payload,
        status: "needs_review",
        syncPending: true,
      } as QueueOverlayTransaction<T>);
      continue;
    }
    if (!existing) continue;
    projected.set(operation.transactionId, {
      ...existing,
      ...operation.payload,
      status: operation.kind === "soft-delete" ? "deleted" : existing.status,
      syncPending: true,
    });
  }
  return [...projected.values()];
}

export type TransactionReplayAdapter = {
  create: (operation: QueuedTransactionOperation) => Promise<"done" | "conflict">;
  edit: (operation: QueuedTransactionOperation) => Promise<"done" | "conflict">;
  softDelete: (operation: QueuedTransactionOperation) => Promise<"done" | "conflict">;
};

export async function replayQueuedTransactionOperations(userId: string, adapter: TransactionReplayAdapter) {
  const operations = await listQueuedTransactionOperations(userId);
  const results: Array<{ opId: string; state: "done" | "pending" | "conflict" }> = [];
  for (const operation of operations) {
    if (operation.state === "conflict") {
      results.push({ opId: operation.opId, state: "conflict" });
      continue;
    }
    try {
      const result = operation.kind === "create"
        ? await adapter.create(operation)
        : operation.kind === "edit"
          ? await adapter.edit(operation)
          : await adapter.softDelete(operation);
      if (result === "done") {
        await removeQueuedTransactionOperation(operation.opId);
        results.push({ opId: operation.opId, state: "done" });
      } else {
        await updateQueuedTransactionOperation({ ...operation, state: "conflict", lastError: "Data server berubah atau tidak tersedia." });
        results.push({ opId: operation.opId, state: "conflict" });
      }
    } catch {
      await updateQueuedTransactionOperation({ ...operation, attempts: operation.attempts + 1, lastError: "Sinkronisasi belum berhasil." });
      results.push({ opId: operation.opId, state: "pending" });
      break;
    }
  }
  return results;
}

export function createQueuedTransactionOperation({ userId, kind, transactionId, payload, baseUpdatedAt }: Pick<QueuedTransactionOperation, "userId" | "kind" | "transactionId" | "payload" | "baseUpdatedAt">): QueuedTransactionOperation {
  return {
    opId: crypto.randomUUID(),
    userId,
    kind,
    transactionId,
    payload,
    baseUpdatedAt,
    createdAt: new Date().toISOString(),
    attempts: 0,
    state: "pending",
    lastError: null,
  };
}
