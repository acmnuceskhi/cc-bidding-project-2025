"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function NavigationLoader() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [previousPath, setPreviousPath] = useState(pathname);

  useEffect(() => {
    // When pathname changes, show loading
    if (pathname !== previousPath) {
      setLoading(true);

      // Minimum loading time to make it visible (300ms)
      const timer = setTimeout(() => {
        setLoading(false);
        setPreviousPath(pathname);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [pathname, previousPath]);

  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900 flex items-center justify-center">
      <div className="text-center">
        {/* Animated Loading Circle */}
        <div className="relative mb-12">
          {/* Outer spinning ring */}
          <div className="animate-spin rounded-full h-32 w-32 border-8 border-yellow-400 border-t-transparent mx-auto"></div>
          {/* Inner pulsing circle */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="animate-pulse rounded-full h-20 w-20 bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
              <span className="text-3xl">🥋</span>
            </div>
          </div>
        </div>

        {/* Bouncy CODERS CUP Text */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <span
            className="text-4xl font-bold text-yellow-400 animate-bounce"
            style={{ animationDelay: "0s" }}
          >
            C
          </span>
          <span
            className="text-4xl font-bold text-yellow-300 animate-bounce"
            style={{ animationDelay: "0.1s" }}
          >
            O
          </span>
          <span
            className="text-4xl font-bold text-yellow-400 animate-bounce"
            style={{ animationDelay: "0.2s" }}
          >
            D
          </span>
          <span
            className="text-4xl font-bold text-yellow-300 animate-bounce"
            style={{ animationDelay: "0.3s" }}
          >
            E
          </span>
          <span
            className="text-4xl font-bold text-yellow-400 animate-bounce"
            style={{ animationDelay: "0.4s" }}
          >
            R
          </span>
          <span
            className="text-4xl font-bold text-yellow-300 animate-bounce"
            style={{ animationDelay: "0.5s" }}
          >
            S
          </span>
          <span className="text-4xl font-bold text-red-500 mx-3">⚔️</span>
          <span
            className="text-4xl font-bold text-yellow-400 animate-bounce"
            style={{ animationDelay: "0.6s" }}
          >
            C
          </span>
          <span
            className="text-4xl font-bold text-yellow-300 animate-bounce"
            style={{ animationDelay: "0.7s" }}
          >
            U
          </span>
          <span
            className="text-4xl font-bold text-yellow-400 animate-bounce"
            style={{ animationDelay: "0.8s" }}
          >
            P
          </span>
        </div>

        {/* Loading subtitle */}
        <p className="text-xl text-gray-300 animate-pulse">Loading arena...</p>
      </div>
    </div>
  );
}
