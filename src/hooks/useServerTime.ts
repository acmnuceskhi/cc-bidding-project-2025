import { useState, useEffect } from "react";

export function useServerTime(initialServerTime?: number) {
  const [offset, setOffset] = useState(() => {
    // If initial server time provided, use it to seed offset before first fetch
    if (initialServerTime) {
      return initialServerTime - Date.now();
    }
    return 0;
  });

  useEffect(() => {
    async function sync() {
      const clientSent = Date.now();
      const res = await fetch("/api/time");
      const clientRecv = Date.now();
      const data = await res.json();

      const rtt = clientRecv - clientSent;
      const serverTime = data.serverTime;
      setOffset(serverTime - (clientSent + rtt / 2));
    }

    sync();
    const interval = setInterval(sync, 10000); // Sync every 10s
    return () => clearInterval(interval);
  }, []);

  function serverNow() {
    return Date.now() + offset;
  }

  return { serverNow, offset };
}
