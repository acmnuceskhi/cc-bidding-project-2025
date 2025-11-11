/**
 * Export Bids Script
 *
 * Dumps full bid history to a CSV file including enrichment fields.
 * Columns: bidId,roundId,houseId,houseName,participantId,participantName,amount,timestampISO
 *
 * Usage:
 *   npx tsx src/scripts/export-bids.ts                # auto file name
 *   npx tsx src/scripts/export-bids.ts ./exports/bids.csv  # custom path
 */
import { config } from "dotenv";
import path from "path";
import fs from "fs";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[,"\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

async function exportBids() {
  const outArg = process.argv[2];
  const timestamp = new Date()
    .toISOString()
    .replace(/[:]/g, "-")
    .replace(/\..+/, "");
  const defaultName = `bids-${timestamp}.csv`;
  const outputPath = outArg
    ? path.resolve(process.cwd(), outArg)
    : path.resolve(process.cwd(), defaultName);

  try {
    console.log("📦 Connecting to MongoDB...");
    const client = await clientPromise;
    const db = client.db();
    console.log("✅ Connected. Fetching data...");

    const [bids, housesArr, participantsArr, roundsArr] = await Promise.all([
      db.collection("bids").find({}).sort({ timestamp: 1 }).toArray(),
      db.collection("houses").find({}).toArray(),
      db.collection("participants").find({}).toArray(),
      db.collection("rounds").find({}).toArray(),
    ]);

    type HouseDoc = { _id: ObjectId; name: string };
    type ParticipantDoc = { _id: ObjectId; name?: string };
    const houses = new Map<string, HouseDoc>();
    const participants = new Map<string, ParticipantDoc>();
    const rounds = new Map<string, { _id: ObjectId }>();
    for (const h of housesArr) {
      const name: string = typeof h.name === "string" ? h.name : "";
      houses.set(h._id.toString(), { _id: h._id as ObjectId, name });
    }
    for (const p of participantsArr) {
      const pname: string | undefined =
        typeof p.name === "string" ? p.name : undefined;
      participants.set(p._id.toString(), {
        _id: p._id as ObjectId,
        name: pname,
      });
    }
    for (const r of roundsArr) {
      rounds.set(r._id.toString(), { _id: r._id as ObjectId });
    }

    // Build CSV rows
    const header = [
      "bidId",
      "roundId",
      "houseId",
      "houseName",
      "participantId",
      "participantName",
      "amount",
      "timestampISO",
    ];

    const rows: string[] = [header.join(",")];

    for (const bid of bids) {
      const roundId =
        bid.roundId instanceof ObjectId
          ? bid.roundId.toString()
          : String(bid.roundId);
      const houseId =
        bid.houseId instanceof ObjectId
          ? bid.houseId.toString()
          : String(bid.houseId);
      const participantId =
        bid.participantId instanceof ObjectId
          ? bid.participantId.toString()
          : String(bid.participantId);
      const house = houses.get(houseId);
      const participant = participants.get(participantId);
      rows.push(
        [
          escapeCsv(bid._id?.toString()),
          escapeCsv(roundId),
          escapeCsv(houseId),
          escapeCsv(house?.name ?? ""),
          escapeCsv(participantId),
          escapeCsv(participant?.name ?? ""),
          escapeCsv(bid.amount),
          escapeCsv(new Date(bid.timestamp).toISOString()),
        ].join(",")
      );
    }

    // Ensure directory exists
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, rows.join("\n"), "utf8");

    console.log(`\n✅ Exported ${bids.length} bids to: ${outputPath}`);
    console.log("   Columns: " + header.join(", "));
    console.log("   Sample (first row after header):");
    if (bids.length) {
      console.log("   " + rows[1]);
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to export bids:", err);
    process.exit(1);
  }
}

exportBids();
