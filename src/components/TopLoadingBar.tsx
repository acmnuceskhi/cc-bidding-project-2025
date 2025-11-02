"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function TopLoadingBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Show loading bar at top
    const loadingBar = document.getElementById("top-loading-bar");
    if (loadingBar) {
      loadingBar.style.width = "0%";
      loadingBar.style.opacity = "1";

      // Animate to 70% quickly
      setTimeout(() => {
        if (loadingBar) loadingBar.style.width = "70%";
      }, 50);

      // Complete after a short delay
      setTimeout(() => {
        if (loadingBar) {
          loadingBar.style.width = "100%";
          // Fade out
          setTimeout(() => {
            if (loadingBar) loadingBar.style.opacity = "0";
          }, 200);
        }
      }, 400);
    }
  }, [pathname, searchParams]);

  return (
    <div
      id="top-loading-bar"
      className="fixed top-0 left-0 h-1 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 z-[9999] transition-all duration-300 ease-out shadow-lg shadow-yellow-500/50"
      style={{ width: "0%", opacity: 0 }}
    />
  );
}
