import { NextRequest, NextResponse } from "next/server";
import { Rounds } from "@/lib/models/rounds";
import { ObjectId } from "mongodb";

// GET /api/rounds/[id] - Fetch a single round by ID
export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        if (!id || !ObjectId.isValid(id)) {
            return NextResponse.json(
                { error: "Invalid round ID" },
                { status: 400 }
            );
        }

        const round = await Rounds.getById(id);
        if (!round) {
            return NextResponse.json({ error: "Round not found" }, { status: 404 });
        }

        return NextResponse.json({
            _id: round._id?.toString(),
            roundId: round._id?.toString(),
            teamId: round.teamId.toString(),
            status: round.status,
            passPhase: round.passPhase ?? 1,
            timerEnd: round.timerEnd ? round.timerEnd.toISOString() : null,
            scheduledStart: round.scheduledStart ? round.scheduledStart.toISOString() : null,
            finalized: !!round.finalized,
            winningBid: round.winningBid ?? null,
            skipped: !!round.skipped,
        });
    } catch (error) {
        console.error("Error fetching round by id:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
