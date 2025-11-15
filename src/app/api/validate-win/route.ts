import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, hasRole } from "@/lib/auth";
import { Config } from "@/lib/models/config";
import { Bids } from "@/lib/models/bids";
import { Houses } from "@/lib/models/houses";
import { Teams } from "@/lib/models/teams";
import clientPromise from "@/lib/mongodb";
import { getSocketInstance } from "@/lib/socket-instance";
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

        // Handle CANCEL action: delete all bids for the team and broadcast updates
        if (body?.action === "cancel") {
            const client = await clientPromise;
            const db = client.db();
            // Get existing bids to notify houses after deletion
            const existing = await Bids.getByTeam(teamId);
            await db
                .collection("bids")
                .deleteMany({ teamId: new ObjectId(teamId) });

            // Broadcast empty bids list to admins and zero amounts to each affected house
            try {
                const io = getSocketInstance();
                if (io) {
                    io.to("admins").emit("bids-update", { teamId, bids: [] });
                    const notified = new Set<string>();
                    for (const bid of existing) {
                        const hId = bid.houseId.toString();
                        if (notified.has(hId)) continue;
                        notified.add(hId);
                        io.to(`house:${hId}`).emit("bids-update", { teamId, houseId: hId, amount: 0 });
                    }
                }
            } catch { }

            return NextResponse.json({ success: true, cancelled: true });
        }

        // Ensure team exists and check if already assigned (validated)
        const teamDoc = await Teams.getById(teamId);
        if (!teamDoc) return NextResponse.json({ error: "Team not found" }, { status: 404 });

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

        // If already assigned to a house, treat as already validated and skip budget deduction
        if (teamDoc.houseId) {
            const assignedHouseId = teamDoc.houseId.toString();
            const assignedHouseName = houseNameById.get(assignedHouseId) || "Unknown";
            const winningAmount = allBids.find((b) => b.houseId === assignedHouseId)?.amount ?? null;
            return NextResponse.json({
                success: true,
                alreadyValidated: true,
                winner: {
                    houseId: assignedHouseId,
                    houseName: assignedHouseName,
                    amount: winningAmount,
                    timestamp: new Date().toISOString(),
                },
                allBids,
                message: "Team already validated (assigned to a house)",
            });
        }

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

        // Emit budget update to the winning house and admins
        try {
            const io = getSocketInstance();
            if (io) {
                const db = (await clientPromise).db();
                const updatedHouse = await db.collection<{ remainingBudget: number }>("houses").findOne({ _id: new ObjectId(winner.houseId) });
                const remainingBudget = updatedHouse?.remainingBudget ?? undefined;
                if (typeof remainingBudget === "number") {
                    io.to(`house:${winner.houseId}`).emit("budget-update", { houseId: winner.houseId, remainingBudget });
                    io.to("admins").emit("budget-update", { houseId: winner.houseId, remainingBudget });
                }
            }
        } catch { }

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
