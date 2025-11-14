"use client";

import { FullPageSpinner } from "@/components/Spinner";

export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <FullPageSpinner message="Loading..." />
    </div>
  );
}
