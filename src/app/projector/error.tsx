"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Projector page error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 to-red-700 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4">Error</h1>
        <p className="text-xl mb-8">Something went wrong with the projector display</p>
        <button
          onClick={reset}
          className="bg-white text-red-900 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}