import { afterEach, describe, expect, it, vi } from "vitest";
import { createTimeoutSignal } from "./async";

describe("createTimeoutSignal", () => {
  afterEach(() => vi.useRealTimers());

  it("aborts after the configured deadline", () => {
    vi.useFakeTimers();
    const timeout = createTimeoutSignal(5_000);
    expect(timeout.signal.aborted).toBe(false);
    vi.advanceTimersByTime(5_000);
    expect(timeout.signal.aborted).toBe(true);
    timeout.cleanup();
  });

  it("can be cleaned up before the deadline", () => {
    vi.useFakeTimers();
    const timeout = createTimeoutSignal(5_000);
    timeout.cleanup();
    vi.advanceTimersByTime(5_000);
    expect(timeout.signal.aborted).toBe(false);
  });
});
