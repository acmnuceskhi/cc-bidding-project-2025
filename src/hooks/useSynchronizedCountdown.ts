import { useEffect, useRef, useState } from "react";

/**
 * useCountdown
 * Client-side countdown using device time.
 * Calculates remaining time based on timerEnd timestamp and local device clock.
 */
export function useCountdown(timerEndISO?: string | null) {
  const [remainingMs, setRemainingMs] = useState<number>(0);
  const endMsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastValueRef = useRef<number>(-1);
  const runningRef = useRef<boolean>(false);

  // Update end time when input changes
  useEffect(() => {
    endMsRef.current = timerEndISO ? new Date(timerEndISO).getTime() : null;
  }, [timerEndISO]);

  useEffect(() => {
    if (runningRef.current) return; // ensure single loop instance
    runningRef.current = true;

    const loop = () => {
      const endMs = endMsRef.current;
      let nextRemaining = 0;
      if (endMs) {
        // Use client device time (Date.now())
        const now = Date.now();
        nextRemaining = Math.max(0, endMs - now);
      }
      // Only update state when the second changes (floor value differs)
      // This prevents setState on every rAF frame (60fps) and only updates once per second
      const currentSecond = Math.floor(nextRemaining / 1000);
      const lastSecond = Math.floor(lastValueRef.current / 1000);

      if (
        currentSecond !== lastSecond ||
        (lastValueRef.current === -1 && nextRemaining === 0)
      ) {
        lastValueRef.current = nextRemaining;
        setRemainingMs(nextRemaining);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      runningRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // start loop once

  const seconds = Math.floor(remainingMs / 1000);
  return { remainingMs, seconds };
}

// Export with old name for backward compatibility
export const useSynchronizedCountdown = useCountdown;
