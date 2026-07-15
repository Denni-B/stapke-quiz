"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    if (!basePath || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register(`${basePath}/sw.js`, { scope: `${basePath}/` })
      .catch(() => {
        // Service worker is optional; the app still works on same-origin dev.
      });
  }, []);

  return null;
}
