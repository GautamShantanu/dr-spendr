import { useState, useEffect, useRef } from "react";

/* Pull-from-top to refresh, like native mobile apps. Calls onRefresh() when
   the user drags down past a threshold while the page is scrolled to the top.
   Returns { pull, refreshing } for rendering an indicator. */
export function usePullToRefresh(onRefresh) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const pulled = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    const THRESHOLD = 64;
    const onStart = (e) => {
      startY.current = window.scrollY <= 0 && !busy.current ? e.touches[0].clientY : null;
    };
    const onMove = (e) => {
      if (startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && window.scrollY <= 0) {
        pulled.current = Math.min(dy * 0.5, 90); // damped
        setPull(pulled.current);
      } else {
        pulled.current = 0;
        setPull(0);
      }
    };
    const onEnd = async () => {
      if (startY.current == null) return;
      startY.current = null;
      if (pulled.current >= THRESHOLD) {
        busy.current = true;
        setRefreshing(true);
        setPull(44);
        try { await onRefresh(); } catch { /* ignore */ }
        busy.current = false;
        setRefreshing(false);
      }
      pulled.current = 0;
      setPull(0);
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };
  }, [onRefresh]);

  return { pull, refreshing };
}
