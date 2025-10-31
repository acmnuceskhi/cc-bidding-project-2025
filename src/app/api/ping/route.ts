// backend in src/app/api as subfolders
// file path acts as URL

import clientPromise from "@/lib/mongodb";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("cc_bidding_test"); // any DB name for dev
    const serverStatus = await db.command({ ping: 1 });
    return new Response(JSON.stringify({ status: "ok", serverStatus }));
  } catch (e) {
    return new Response(JSON.stringify({ error: `${e}` }));
  }
}
