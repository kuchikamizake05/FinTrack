export const PASSKEY_STATE_CHANGE_EVENT = "fintrack-passkey-state-change";

type PasskeyDeviceState = {
  version: 1;
  userId: string;
  emailHint: string;
  enabled: boolean;
  locked: boolean;
  updatedAt: string;
};

export type PasskeyDeviceStateInput = Omit<PasskeyDeviceState, "version" | "updatedAt"> & {
  updatedAt?: string;
};

export function buildPasskeyDeviceStorageKey(userId: string) {
  return `fintrack:passkey-device:v1:${userId}`;
}

export function maskPasskeyEmail(email: string | null | undefined) {
  if (!email) return "Akun FinTrack";
  const [local, domain] = email.split("@");
  if (!local || !domain) return "Akun FinTrack";
  return `${local.slice(0, 2)}${"•".repeat(Math.max(2, Math.min(6, local.length - 2)))}@${domain}`;
}

export function parsePasskeyDeviceState(raw: string | null, userId: string): PasskeyDeviceState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PasskeyDeviceState>;
    if (
      value.version !== 1
      || value.userId !== userId
      || typeof value.emailHint !== "string"
      || typeof value.enabled !== "boolean"
      || typeof value.locked !== "boolean"
      || typeof value.updatedAt !== "string"
      || !Number.isFinite(Date.parse(value.updatedAt))
    ) return null;
    return value as PasskeyDeviceState;
  } catch {
    return null;
  }
}

export function readPasskeyDeviceState(userId: string) {
  try {
    return parsePasskeyDeviceState(window.localStorage.getItem(buildPasskeyDeviceStorageKey(userId)), userId);
  } catch {
    return null;
  }
}

export function writePasskeyDeviceState(input: PasskeyDeviceStateInput) {
  const state: PasskeyDeviceState = {
    ...input,
    version: 1,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(buildPasskeyDeviceStorageKey(state.userId), JSON.stringify(state));
    window.dispatchEvent(new Event(PASSKEY_STATE_CHANGE_EVENT));
  } catch {
    // ponytail: browser storage unavailable; Passkey enrollment remains usable without local app lock.
  }
  return state;
}

export function clearPasskeyDeviceState(userId: string) {
  try {
    window.localStorage.removeItem(buildPasskeyDeviceStorageKey(userId));
    window.dispatchEvent(new Event(PASSKEY_STATE_CHANGE_EVENT));
  } catch {
    // Storage is unavailable.
  }
}

export function isWebAuthnSupported() {
  return typeof window !== "undefined" && "PublicKeyCredential" in window;
}

export function getPasskeyErrorMessage(error: unknown) {
  if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "AbortError")) {
    return "Verifikasi Passkey dibatalkan. Coba lagi saat siap.";
  }
  if (error instanceof DOMException && error.name === "NotSupportedError") {
    return "Perangkat atau browser ini belum mendukung Passkey.";
  }
  return "Passkey belum dapat diproses. Coba lagi.";
}
