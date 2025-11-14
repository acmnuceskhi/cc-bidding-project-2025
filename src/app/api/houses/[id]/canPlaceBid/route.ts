import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { Houses } from "@/lib/models/houses";
import { Teams } from "@/lib/models/teams";
import { Config } from "@/lib/models/config";
import { ObjectId } from "mongodb";

/**
 * GET /api/houses/[id]/canPlaceBid?teamId=<teamId>
 * Checks if the specified house can place a bid on a given team.
 * Enforces a rule: A house can have at most N teams from the same batch (configurable via maxTeamsPerBatch).
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
    const teamId = searchParams.get("teamId");

    if (!teamId || !ObjectId.isValid(teamId)) {
      return NextResponse.json(
        { error: "Invalid or missing teamId" },
        { status: 400 }
      );
    }

    // Validate house and team existence
    const house = await Houses.getById(id);
    if (!house) {
      return NextResponse.json({ error: "House not found" }, { status: 404 });
    }

    const team = await Teams.getById(teamId);
    if (!team || !team.batch) {
      return NextResponse.json(
        { error: "Team not found or missing batch" },
        { status: 404 }
      );
    }

    // Get the configurable batch limit
    const maxTeamsPerBatch = await Config.getMaxTeamsPerBatch();

    // Count teams from the same batch already assigned to this house
    const allTeams = await Teams.getAll();
    const houseTeamsInSameBatch = allTeams.filter(
      (t) => t.houseId?.toString() === id && t.batch === team.batch
    ).length;

    if (houseTeamsInSameBatch >= maxTeamsPerBatch) {
      return NextResponse.json({
        canBid: false,
        message: `House '${house.name}' already has ${maxTeamsPerBatch} teams from batch '${team.batch}'.`,
      });
    }

    // ✅ Eligible to place bid
    return NextResponse.json({
      canBid: true,
      message: `House '${house.name}' can bid on this team.`,
    });
  } catch (error) {
    console.error("Error in can-bid API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
