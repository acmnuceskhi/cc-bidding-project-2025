import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      serverTime: Date.now(),
      isoString: new Date().toISOString(),
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
