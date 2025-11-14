"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function TopLoadingBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);

    const handleComplete = () => setLoading(false);

    // This is a bit of a hack, but it works for now.
    // We assume that if the page is still loading after 1.5s, it's done.
    const timer = setTimeout(handleComplete, 1500);

    return () => {
      clearTimeout(timer);
      handleComplete();
    };
  }, [pathname, searchParams]);

  return (
    <div
      className={`fixed top-0 left-0 h-1 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 z-[9999] transition-all duration-1000 ease-out shadow-lg shadow-yellow-500/50 ${
        loading ? "w-full" : "w-0 opacity-0"
      }`}
    />
  );
}
