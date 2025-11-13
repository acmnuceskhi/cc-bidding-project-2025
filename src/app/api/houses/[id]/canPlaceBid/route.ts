import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { Houses } from "@/lib/models/houses";
import { Participants } from "@/lib/models/participants";
import { ObjectId } from "mongodb";

/**
 * GET /api/houses/[id]/canPlaceBid?participantId=<participantId>
 * Checks if the specified house can place a bid on a given participant.
 * Enforces a rule: A house can have at most 3 members from the same batch year (22–25).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    console.log("house id ", id);
    if (!id) {
      return NextResponse.json(
        { error: "Invalid or missing house ID" },
        { status: 400 }
      );
    }

    // Parse query parameter
    const { searchParams } = new URL(request.url);
    const participantId = searchParams.get("participantId");

    if (!participantId || !ObjectId.isValid(participantId)) {
      return NextResponse.json(
        { error: "Invalid or missing participantId" },
        { status: 400 }
      );
    }

    // Validate house and participant existence
    const house = await Houses.getById(id);
    if (!house) {
      return NextResponse.json(
        { error: "House not found" },
        { status: 404 }
      );
    }

    const participant = await Participants.getById(participantId);
    if (!participant || !participant.rollNumber) {
      return NextResponse.json(
        { error: "Participant not found or missing rollNumber" },
        { status: 404 }
      );
    }

    // Extract batch year (e.g., "23" from "23C-1234")
    const batchYearPrefix = participant.rollNumber.slice(0, 2);

    // Get all participants already recruited by this house
    const houseMembers = await Participants.getByHouse(id);

    // Count how many of them share the same batch year prefix
    const sameBatchCount = houseMembers.filter(
      (member) => member.rollNumber?.startsWith(batchYearPrefix)
    ).length;

    if (sameBatchCount >= 3) {
      return NextResponse.json({
        canBid: false,
        message: `House '${house.name}' already has 3 participants from batch '${batchYearPrefix}'.`,
      });
    }

    // ✅ Eligible to place bid
    return NextResponse.json({
      canBid: true,
      message: `House '${house.name}' can bid on this participant.`,
    });
  } catch (error) {
    console.error("Error in can-bid API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
