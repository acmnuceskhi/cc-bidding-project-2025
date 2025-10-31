import { NextResponse } from "next/server";

// Central API route module for /api. Keep this file minimal and export
// handlers (GET/POST/etc.) so TypeScript/Next.js treats it as a module.

export const GET = async () => {
  // Minimal health response. Other shared logic (auth hooks, middleware)
  // can be added here as needed.
  return NextResponse.json({ ok: true });
};
