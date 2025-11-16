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
    console.error("Admin Main Page Error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="bg-red-900/20 border-2 border-red-500 rounded-2xl p-8 max-w-2xl">
        <h2 className="text-2xl font-bold text-red-400 mb-4">
          ⚠️ Admin Main Page Error
        </h2>
        <p className="text-gray-300 mb-4">
          {error.message || "Something went wrong loading the admin main page"}
        </p>
        <button
          onClick={() => reset()}
          className="px-6 py-3 bg-[#FFD700] text-black font-bold rounded-xl hover:bg-[#FFB800] transition-all"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
