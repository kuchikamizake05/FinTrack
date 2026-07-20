"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Download, RefreshCw, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { reportHandledError } from "@/lib/errors";
import {
  getInstallPromptState,
  getNetworkSnapshot,
  getServerNetworkSnapshot,
  shouldRegisterServiceWorker,
  subscribeToNetworkStatus,
} from "@/lib/pwa";

const installDismissedKey = "fintrack-install-dismissed-at";

export default function PWARegister() {
  const online = useSyncExternalStore(
    subscribeToNetworkStatus,
    getNetworkSnapshot,
    getServerNetworkSnapshot,
  );
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const reloadOnControllerChangeRef = useRef(false);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      const standalone = window.matchMedia("(display-mode: standalone)").matches
        || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
      const state = getInstallPromptState({
        standalone,
        dismissedAt: window.localStorage.getItem(installDismissedKey),
        now: Date.now(),
      });
      if (state === "eligible") {
        setInstallPrompt(promptEvent);
        setShowInstall(true);
      }
    };
    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setShowInstall(false);
      window.localStorage.removeItem(installDismissedKey);
    };
    const handleControllerChange = () => {
      if (!reloadOnControllerChangeRef.current) return;
      reloadOnControllerChangeRef.current = false;
      window.location.reload();
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    navigator.serviceWorker?.addEventListener("controllerchange", handleControllerChange);

    const serviceWorkerSupported = "serviceWorker" in navigator;
    if (!shouldRegisterServiceWorker(process.env.NODE_ENV, serviceWorkerSupported)) {
      if (serviceWorkerSupported) {
        void navigator.serviceWorker.getRegistrations().then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister())),
        );
      }
      if ("caches" in window) {
        void caches.keys().then((cacheNames) =>
          Promise.all(cacheNames.filter((name) => name.startsWith("fintrack-")).map((name) => caches.delete(name))),
        );
      }
    } else {
      const register = async () => {
        try {
          const registration = await navigator.serviceWorker.register("/sw.js");
          registrationRef.current = registration;
          if (registration.waiting && navigator.serviceWorker.controller) setUpdateAvailable(true);
          registration.addEventListener("updatefound", () => {
            const installing = registration.installing;
            installing?.addEventListener("statechange", () => {
              if (installing.state === "installed" && navigator.serviceWorker.controller) setUpdateAvailable(true);
            });
          });
        } catch (error) {
          reportHandledError("PWA service worker registration failed", error, "Service worker belum dapat didaftarkan.");
        }
      };
      if (document.readyState === "complete") void register();
      else window.addEventListener("load", register, { once: true });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      navigator.serviceWorker?.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
    setShowInstall(false);
  }

  function dismissInstall() {
    window.localStorage.setItem(installDismissedKey, String(Date.now()));
    setShowInstall(false);
  }

  function applyUpdate() {
    const waitingWorker = registrationRef.current?.waiting;
    if (!waitingWorker) return;
    reloadOnControllerChangeRef.current = true;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  }

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[90] mx-auto flex max-w-md flex-col gap-2 md:bottom-6" aria-live="polite" aria-atomic="true">
      {!online && (
        <StatusCard icon={WifiOff} title="Kamu sedang offline" description="Data yang sudah terbuka tetap bisa dibaca. Perubahan baru menunggu koneksi kembali." />
      )}
      {updateAvailable && (
        <StatusCard icon={RefreshCw} title="Versi baru tersedia" description="Muat ulang untuk memakai pembaruan terbaru." action={<Button size="compact" onClick={applyUpdate}><RefreshCw className="h-3.5 w-3.5" /> Perbarui</Button>} />
      )}
      {showInstall && installPrompt && (
        <StatusCard
          icon={Download}
          title="Pasang FinTrack"
          description="Buka lebih cepat dari layar utama dan nikmati tampilan penuh seperti aplikasi."
          action={<div className="flex gap-1"><Button variant="ghost" size="icon" className="h-9 w-9 min-h-9" onClick={dismissInstall} aria-label="Ingatkan nanti"><X className="h-4 w-4" /></Button><Button size="compact" onClick={() => void installApp()}><Download className="h-3.5 w-3.5" /> Pasang</Button></div>}
        />
      )}
    </div>
  );
}

function StatusCard({ icon: Icon, title, description, action }: {
  icon: typeof WifiOff;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white/95 p-3.5 text-slate-900 shadow-[0_16px_45px_rgba(15,23,42,0.16)] backdrop-blur">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-bold">{title}</p><p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p></div>
      {action}
    </section>
  );
}
