"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Warns when the phone loses its connection, because sales are saved to the online database. */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="flex items-center gap-2 bg-warn-soft px-4 py-2 text-sm font-medium text-warn">
      <WifiOff className="size-4 shrink-0" aria-hidden />
      No internet. You can look around, but sales and changes cannot be saved until you are back online.
    </div>
  );
}
