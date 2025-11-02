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
    // Log the error to an error reporting service
    console.error("Application error:", error);
  }, [error]);

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed relative"
      style={{
        backgroundImage: "url('/arena-background.jpg')",
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="max-w-2xl w-full">
          {/* Error Card */}
          <div className="bg-gradient-to-br from-red-900 to-black rounded-3xl p-12 border-4 border-red-600 shadow-2xl text-center">
            {/* Icon */}
            <div className="text-8xl mb-6 animate-pulse">⚠️</div>

            {/* Title */}
            <h1 className="text-5xl font-bold text-red-500 mb-4 drop-shadow-lg">
              Battle Interrupted!
            </h1>

            {/* Subtitle */}
            <p className="text-2xl text-gray-300 mb-8">
              Something went wrong in the arena
            </p>

            {/* Error Message */}
            <div className="bg-black/60 rounded-xl p-6 mb-8 border-2 border-red-700">
              <p className="text-red-300 font-mono text-sm break-words">
                {error.message || "An unexpected error occurred"}
              </p>
              {error.digest && (
                <p className="text-gray-500 text-xs mt-2">
                  Error ID: {error.digest}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={reset}
                className="bg-yellow-600 hover:bg-yellow-700 text-black px-8 py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-lg border-2 border-yellow-400"
              >
                ⚔️ Try Again
              </button>
              <a
                href="/"
                className="bg-gray-700 hover:bg-gray-600 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-lg border-2 border-gray-500"
              >
                🏯 Return Home
              </a>
            </div>

            {/* Helper Text */}
            <p className="text-gray-400 text-sm mt-8">
              If this problem persists, please contact the tournament organizers
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
