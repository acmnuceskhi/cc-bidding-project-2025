import { NextRequest, NextResponse } from "next/server";
import { Bids } from "@/lib/models/bids";
import { Houses } from "@/lib/models/houses";
import { Rounds } from "@/lib/models/rounds";
import { Participants } from "@/lib/models/participants"; 
import { verifyAuth } from "@/lib/auth";

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

    // 🧍 Get participant being bid on
    const participant = await Participants.getById(round.participantId.toString());
    if (!participant || !participant.rollNumber) {
      return NextResponse.json(
        { success: false, error: "PARTICIPANT_NOT_FOUND", message: "Participant not found or missing university ID" },
        { status: 404 }
      );
    }

    // 🎓 Extract the batch year (first 2 digits of rollNumber)
    const batchPrefix = participant.rollNumber.slice(0, 2);

    // If amount === 0, interpret as an explicit "skip" (captain not interested).
    // Do NOT create/update a bid document, and do NOT enforce batch limits.
    if (amount === 0) {
      return NextResponse.json({
        success: true,
        remainingBudget: house.remainingBudget,
        message: "No bid (skip)",
      });
    }

    // 👥 Get all participants already assigned to this house (only relevant for real bids)
    const houseMembers = await Participants.getByHouse(houseId);

    // Count how many have the same batch prefix
    const sameBatchCount = houseMembers.filter(
      (p) => p.rollNumber?.startsWith(batchPrefix)
    ).length;

    // ❌ Enforce the 3-per-batch limit for actual bids
    if (sameBatchCount >= 3) {
      return NextResponse.json(
        {
          success: false,
          error: "BATCH_LIMIT_REACHED",
          message: `House '${house.name}' already has 3 members from batch '${batchPrefix}'.`,
        },
        { status: 403 }
      );
    }

    const isNew: boolean = previousAmount === null;

    // Place or update the bid (NO budget deduction here)
    // Budget is only deducted when the round ends and they win
    await Bids.upsertBid(
      roundId,
      houseId,
      round.participantId.toString(),
      amount
    );

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
    const participantId = searchParams.get("participantId");
    const houseId = searchParams.get("houseId");
    const roundId = searchParams.get("roundId");

    let bids;
    if (roundId) {
      bids = await Bids.getByRound(roundId);
    } else if (participantId) {
      bids = await Bids.getByParticipant(participantId);
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
