import { useEffect, useRef } from "react";

const DEFAULT_REFRESH_MS = 10_000;
// Overridable for the end-to-end suite (NFR-08: status refreshes at least every 10 seconds).
export const REFRESH_MS = Number(import.meta.env.VITE_REFRESH_MS) || DEFAULT_REFRESH_MS;

// Runs `load` now and then on an interval; stops when the component unmounts.
export function usePolling(load: () => Promise<void>, intervalMs: number = REFRESH_MS) {
  const latest = useRef(load);
  latest.current = load;
  useEffect(() => {
    void latest.current();
    const id = setInterval(() => void latest.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
