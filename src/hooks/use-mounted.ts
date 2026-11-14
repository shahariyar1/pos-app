import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
/** false during SSR/hydration, true afterwards. Guards persisted-store UI against hydration mismatches. */
export function useMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
