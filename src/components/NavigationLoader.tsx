"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FullPageSpinner } from "@/components/Spinner";

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
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center">
      <FullPageSpinner message="Loading..." />
    </div>
  );
}
