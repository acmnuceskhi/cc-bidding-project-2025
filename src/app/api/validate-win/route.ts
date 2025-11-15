import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, hasRole } from "@/lib/auth";
import { Config } from "@/lib/models/config";
import { Bids } from "@/lib/models/bids";
import { Houses } from "@/lib/models/houses";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

// POST /api/validate-win
// Admin-only. Finalizes the winner for the current team (or provided teamId)
export async function POST(request: NextRequest) {
    try {
        const auth = await verifyAuth(request);
        if (!auth) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
        if (!hasRole(auth.payload, "admin")) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

        const body = await request.json().catch(() => ({}));
        const teamId: string | undefined = body.teamId || (await Config.get()).currentRound || undefined;
        if (!teamId) return NextResponse.json({ error: "Missing teamId" }, { status: 400 });

        // Gather all bids for the team, latest per house due to unique index
        const bids = await Bids.getByTeam(teamId);

        // Map house data for convenience
        const allHouses = await Houses.getAll();
        const houseNameById = new Map<string, string>();
        for (const h of allHouses) {
            const id = h._id?.toString();
            if (id) houseNameById.set(id, h.name);
        }

        // Sort for display: amount desc, timestamp asc
        const allBids = bids
            .map((b) => ({
                houseId: b.houseId.toString(),
                houseName: houseNameById.get(b.houseId.toString()) || "Unknown",
                amount: b.amount,
                timestamp: b.timestamp?.toISOString() || new Date().toISOString(),
            }))
            .sort((a, b) => {
                if (b.amount !== a.amount) return b.amount - a.amount;
                return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
            });

        if (allBids.length === 0 || allBids[0].amount <= 0) {
            return NextResponse.json({
                success: true,
                winner: null,
                allBids,
                message: "No bids to validate",
            });
        }

        // Winner: highest amount; tie → earliest timestamp
        const winner = allBids[0];

        const client = await clientPromise;
        const session = client.startSession();

        try {
            await session.withTransaction(async () => {
                const db = client.db();

                // Deduct budget from winning house
                await db.collection("houses").updateOne(
                    { _id: new ObjectId(winner.houseId) },
                    { $inc: { remainingBudget: -winner.amount } },
                    { session }
                );

                // Assign team to winning house
                await db.collection("teams").updateOne(
                    { _id: new ObjectId(teamId) },
                    { $set: { houseId: new ObjectId(winner.houseId) } },
                    { session }
                );

                // Assign participants of the team to the winning house
                await db.collection("participants").updateMany(
                    { teamId: new ObjectId(teamId) },
                    { $set: { houseId: new ObjectId(winner.houseId) } },
                    { session }
                );
            });
        } finally {
            await session.endSession();
        }

        return NextResponse.json({
            success: true,
            winner,
            allBids,
        });
    } catch (error) {
        console.error("Error in POST /api/validate-win:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
