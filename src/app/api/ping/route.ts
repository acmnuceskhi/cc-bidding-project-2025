// backend in src/app/api as subfolders
// file path acts as URL

import clientPromise from "@/lib/mongodb";

export async function GET() {
  try {
    const client = await clientPromise;
    // Use default database from connection string
    const db = client.db();
    const serverStatus = await db.command({ ping: 1 });
    return new Response(JSON.stringify({ status: "ok", serverStatus }));
  } catch (e) {
    return new Response(JSON.stringify({ error: `${e}` }));
  }
}
