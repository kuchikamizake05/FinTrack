"use client";

import { useEffect } from "react";
import { shouldRegisterServiceWorker } from "@/lib/pwa";

export default function PWARegister() {
  useEffect(() => {
    const serviceWorkerSupported = "serviceWorker" in navigator;

    if (!shouldRegisterServiceWorker(process.env.NODE_ENV, serviceWorkerSupported)) {
      if (serviceWorkerSupported) {
        void navigator.serviceWorker.getRegistrations().then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister())),
        );
      }

      void caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith("fintrack-cache-"))
            .map((cacheName) => caches.delete(cacheName)),
        ),
      );
      return;
    }

    if (serviceWorkerSupported) {
      const registerServiceWorker = async () => {
        try {
          const registration = await navigator.serviceWorker.register("/sw.js");
          console.log("PWA Service Worker registered with scope:", registration.scope);
        } catch (error) {
          console.error("PWA Service Worker registration failed:", error);
        }
      };

      // Register after window load
      if (document.readyState === "complete") {
        registerServiceWorker();
      } else {
        window.addEventListener("load", registerServiceWorker);
        return () => window.removeEventListener("load", registerServiceWorker);
      }
    }
  }, []);

  return null;
}
