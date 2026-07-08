export function shouldRegisterServiceWorker(environment: string | undefined, isServiceWorkerSupported: boolean) {
  return environment === "production" && isServiceWorkerSupported;
}

export function getServerNetworkSnapshot() {
  return true;
}

export function getNetworkSnapshot() {
  return typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
    ? navigator.onLine
    : getServerNetworkSnapshot();
}

export function subscribeToNetworkStatus(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;

  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);

  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

const INSTALL_PROMPT_COOLDOWN = 7 * 24 * 60 * 60 * 1_000;

export function getInstallPromptState({ standalone, dismissedAt, now }: {
  standalone: boolean;
  dismissedAt: string | null;
  now: number;
}) {
  if (standalone) return "hidden" as const;
  const dismissedTimestamp = Number(dismissedAt);
  if (dismissedAt && Number.isFinite(dismissedTimestamp) && now - dismissedTimestamp < INSTALL_PROMPT_COOLDOWN) {
    return "dismissed" as const;
  }
  return "eligible" as const;
}
