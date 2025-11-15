import { NextRequest, NextResponse } from "next/server";
import { Bids } from "@/lib/models/bids";
import { Houses } from "@/lib/models/houses";
import { Rounds } from "@/lib/models/rounds";
import { Teams } from "@/lib/models/teams";
import { Config } from "@/lib/models/config";
import { verifyAuth } from "@/lib/auth";
import { emitSocketEvent, getSocketInstance } from "@/lib/socket-instance";
import { buildProjectorData } from "@/lib/socket-projector-data";

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
    const { roundId, amount, previousAmount } = body;

    // Validate input
    // Treat 0 as a valid provided value; only undefined/null should be missing
    if (!roundId || amount === undefined || amount === null) {
      return NextResponse.json(
        {
          success: false,
          error: "MISSING_FIELDS",
          message: "Missing required fields: roundId, amount",
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

    // Get the round
    const round = await Rounds.getById(roundId);
    if (!round) {
      return NextResponse.json(
        {
          success: false,
          error: "ROUND_NOT_FOUND",
          message: "Round not found",
        },
        { status: 404 }
      );
    }

    // Check if round is active
    if (round.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          error: "ROUND_NOT_ACTIVE",
          message: "Round is not active",
        },
        { status: 400 }
      );
    }

    // Check if round has expired
    if (!round.timerEnd || new Date() > round.timerEnd) {
      return NextResponse.json(
        {
          success: false,
          error: "ROUND_EXPIRED",
          message: "Round has expired",
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
    const team = await Teams.getById(round.teamId.toString());
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
    const passPhase = round.passPhase ?? 1;

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
    await Bids.upsertBid(roundId, houseId, round.teamId.toString(), amount);

    // Emit socket event to notify all clients of the bid
    emitSocketEvent("bid-placed", {
      houseId,
      houseName: house.name,
      roundId,
    });

    // Emit projector-update with full data (debounced in server.ts handler)
    // This provides full status and houses data without requiring HTTP requests
    const io = getSocketInstance();
    if (io) {
      // Build and emit full projector data
      // Note: This is async but we don't await to avoid blocking the response
      buildProjectorData()
        .then((projectorData) => {
          io.emit("projector-update", projectorData);
        })
        .catch((error) => {
          console.error("Error building projector data after bid:", error);
        });
    }

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
      bids = await Bids.getByRound(roundId);
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
