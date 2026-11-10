"use client";

import { useEffect } from "react";

/** Registers the service worker in production builds so the phone offers "Install app". */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
