import { NextRequest, NextResponse } from "next/server";
import { Bids } from "@/lib/models/bids";
import { Houses } from "@/lib/models/houses";
import { Teams } from "@/lib/models/teams";
import { Config } from "@/lib/models/config";
import { verifyAuth } from "@/lib/auth";
import { emitSocketEvent } from "@/lib/socket-instance";

// POST /api/bids - Place a bid
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED",
          message: "Authentication required",
        },
        { status: 401 }
      );
    }

    const { payload } = authResult;

    // Only house captains can place bids (not admins)
    if (payload.role !== "house_captain") {
      return NextResponse.json(
        {
          success: false,
          error: "FORBIDDEN",
          message: "Only house captains can place bids",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    // Support new team-based API while remaining backward compatible:
    // - Prefer body.teamId
    // - Fallback: treat body.roundId as teamId
    const rawTeamId: string | undefined = body.teamId || body.roundId;
    const { amount, previousAmount } = body;

    // Validate input
    // Treat 0 as a valid provided value; only undefined/null should be missing
    if (!rawTeamId || amount === undefined || amount === null) {
      return NextResponse.json(
        {
          success: false,
          error: "MISSING_FIELDS",
          message: "Missing required fields: teamId, amount",
        },
        { status: 400 }
      );
    }

    if (typeof amount !== "number" || amount < 0) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_AMOUNT",
          message: "Bid amount must be greater than 0",
        },
        { status: 400 }
      );
    }

    // Validate against team-based active window from Config
    const cfg = await Config.get();
    if (!cfg.currentRound || cfg.currentRound !== rawTeamId) {
      return NextResponse.json(
        {
          success: false,
          error: "TEAM_NOT_ACTIVE",
          message: "This team is not currently open for bidding",
        },
        { status: 400 }
      );
    }
    const now = new Date();
    if (!cfg.currentRoundStartTime || !cfg.currentRoundEndTime || now < cfg.currentRoundStartTime || now > cfg.currentRoundEndTime) {
      return NextResponse.json(
        {
          success: false,
          error: "WINDOW_CLOSED",
          message: "Bidding window is not active",
        },
        { status: 400 }
      );
    }

    // Get house ID from user payload
    // console.log("JWT Payload:", payload);
    const houseId = payload.houseId;
    if (!houseId) {
      return NextResponse.json(
        {
          success: false,
          error: "NO_HOUSE_ASSIGNED",
          message: `House captain ${payload.username} is not assigned to a house. Please contact admin.`,
        },
        { status: 400 }
      );
    }

    // Check if house has enough budget for this bid
    const house = await Houses.getById(houseId);
    if (!house) {
      return NextResponse.json(
        {
          success: false,
          error: "HOUSE_NOT_FOUND",
          message: "House not found",
        },
        { status: 404 }
      );
    }

    if (amount > house.remainingBudget) {
      return NextResponse.json(
        {
          success: false,
          error: "INSUFFICIENT_CREDITS",
          message: `You have ${house.remainingBudget} credits remaining, but trying to bid ${amount}`,
        },
        { status: 409 }
      );
    }

    // 🧑‍🤝‍🧑 Get team being bid on
    const team = await Teams.getById(rawTeamId);
    if (!team || !team.batch) {
      return NextResponse.json(
        {
          success: false,
          error: "TEAM_NOT_FOUND",
          message: "Team not found or missing batch information",
        },
        { status: 404 }
      );
    }

    // 🎓 Team batch for limit checking
    const teamBatch = team.batch;

    // If amount === 0, interpret as an explicit "skip" (captain not interested).
    // Do NOT create/update a bid document, and do NOT enforce batch limits.
    if (amount === 0) {
      return NextResponse.json({
        success: true,
        remainingBudget: house.remainingBudget,
        message: "No bid (skip)",
      });
    }

    // 👥 Get all teams already assigned to this house and get max teams per batch from config
    const [houseTeams, config] = await Promise.all([
      Teams.getAll().then((allTeams) =>
        allTeams.filter(
          (t) => t.houseId && t.houseId.toString() === houseId
        )
      ),
      Config.get(),
    ]);

    // 🏷️ In second pass, remove minimum roster check (no longer applicable for team-based bidding)
    const passPhase = 1;

    // Count how many existing teams are in the same batch
    const sameBatchCount = houseTeams.filter((t) => t.batch === teamBatch).length;

    // ❌ Enforce the maxTeamsPerBatch limit for actual bids
    if (sameBatchCount >= config.maxTeamsPerBatch) {
      return NextResponse.json(
        {
          success: false,
          error: "BATCH_LIMIT_REACHED",
          message: `House '${house.name}' already has ${config.maxTeamsPerBatch} teams from batch '${teamBatch}'.`,
        },
        { status: 403 }
      );
    }

    const isNew: boolean = previousAmount === null;

    // Place or update the bid (NO budget deduction here)
    // Budget is only deducted when the round ends and they win
    // Use teamId as the round identifier for bids storage (round-less design)
    await Bids.upsertBid(rawTeamId, houseId, rawTeamId, amount);

    // Emit socket event to notify all clients of the bid
    emitSocketEvent("bid-placed", {
      houseId,
      houseName: house.name,
      // Back-compat: event field name remains roundId but carries teamId
      roundId: rawTeamId,
    });

    return NextResponse.json({
      success: true,
      remainingBudget: house.remainingBudget,
      message: isNew ? "Bid placed successfully" : "Bid updated successfully",
      previousAmount,
      newAmount: amount,
    });
  } catch (error) {
    console.error("Error creating bid:", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}

// GET /api/bids - Get bids (with optional filters)
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { payload } = authResult;
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");
    const houseId = searchParams.get("houseId");
    const roundId = searchParams.get("roundId");

    let bids;
    if (roundId) {
      // Back-compat: treat roundId as teamId
      bids = await Bids.getByTeam(roundId);
    } else if (teamId) {
      bids = await Bids.getByTeam(teamId);
    } else if (houseId) {
      // Check if user can access this house's bids
      if (payload.role !== "admin" && payload.houseId !== houseId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      bids = await Bids.getByHouse(houseId);
    } else {
      // Only admins can see all bids
      if (payload.role !== "admin") {
        return NextResponse.json(
          { error: "Admin access required" },
          { status: 403 }
        );
      }
      bids = await Bids.getAll();
    }

    return NextResponse.json(bids);
  } catch (error) {
    console.error("Error fetching bids:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
