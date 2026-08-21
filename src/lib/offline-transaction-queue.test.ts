import { describe, expect, it } from "vitest";
import {
  createQueuedTransactionOperation,
  projectQueuedTransactionOperations,
  validateQueuedTransactionOperation,
  type QueuedTransactionOperation,
} from "./offline-transaction-queue";

function operation(overrides: Partial<QueuedTransactionOperation> = {}) {
  return {
    opId: "op-1",
    userId: "user-1",
    kind: "create" as const,
    transactionId: "tx-1",
    payload: {
      id: "tx-1",
      date: "2026-08-21",
      type: "expense" as const,
      merchant: "Warung",
      category: "Makan",
      amount: 25_000,
      note: null,
      account_id: "account-1",
      source: "manual" as const,
    },
    baseUpdatedAt: null,
    createdAt: "2026-08-21T00:00:00.000Z",
    attempts: 0,
    state: "pending" as const,
    lastError: null,
    ...overrides,
  };
}

describe("offline transaction queue", () => {
  it("rejects invalid manual payloads", () => {
    expect(validateQueuedTransactionOperation(operation({ payload: { ...operation().payload, amount: 0 } }))).toBe(false);
    expect(validateQueuedTransactionOperation(operation({ payload: { ...operation().payload, source: "manual", category: "" } }))).toBe(false);
    expect(validateQueuedTransactionOperation(operation({ payload: { ...operation().payload, source: "manual", account_id: "" } }))).toBe(false);
  });

  it("projects queued operations FIFO and marks rows pending", () => {
    const create = operation({ createdAt: "2026-08-21T00:00:02.000Z" });
    const edit = operation({
      opId: "op-2",
      kind: "edit",
      createdAt: "2026-08-21T00:00:03.000Z",
      payload: { ...operation().payload, amount: 30_000, merchant: "Warung baru" },
      baseUpdatedAt: "2026-08-20T00:00:00.000Z",
    });
    const result = projectQueuedTransactionOperations([], [edit, create]);

    expect(result).toEqual([expect.objectContaining({ id: "tx-1", merchant: "Warung baru", amount: 30_000, status: "needs_review", syncPending: true })]);
  });

  it("projects queued soft-delete without changing confirmed server row", () => {
    const softDelete = operation({
      kind: "soft-delete",
      payload: { status: "deleted", source: "manual" },
      baseUpdatedAt: "2026-08-20T00:00:00.000Z",
    });
    const result = projectQueuedTransactionOperations([
      { id: "tx-1", status: "confirmed" as const, merchant: "Server row", amount: 10_000 },
    ], [softDelete]);

    expect(result).toEqual([expect.objectContaining({ id: "tx-1", status: "deleted", syncPending: true })]);
  });

  it("creates retry-safe operation shape", () => {
    const queued = createQueuedTransactionOperation({
      userId: "user-1",
      kind: "create",
      transactionId: "tx-1",
      payload: operation().payload,
      baseUpdatedAt: null,
    });

    expect(queued).toMatchObject({ userId: "user-1", transactionId: "tx-1", attempts: 0, state: "pending" });
    expect(validateQueuedTransactionOperation(queued)).toBe(true);
  });
});
