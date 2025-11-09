import { NextRequest, NextResponse } from "next/server";
import { Bids } from "@/lib/models/bids";
import { Houses } from "@/lib/models/houses";
import { Rounds } from "@/lib/models/rounds";
import { verifyAuth} from "@/lib/auth";
import { ObjectId } from "mongodb";

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
    const { roundId, amount } = body;

    // Validate input
    if (!roundId || !amount) {
      return NextResponse.json(
        {
          success: false,
          error: "MISSING_FIELDS",
          message: "Missing required fields: roundId, amount",
        },
        { status: 400 }
      );
    }

    if (amount <= 0) {
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

    // Prevent multiple bids from the same house in this round
    const bidsForRound = await Bids.getByRound(roundId);
    const existingBid = bidsForRound.find(
      (bid) => bid.houseId.toString() === houseId
    );
    if (existingBid) {
      return NextResponse.json(
        {
          success: false,
          error: "BID_ALREADY_EXISTS",
          message: "House has already placed a bid for this round",
        },
        { status: 400 }
      );
    }

    // Atomically reserve budget from house
    // This prevents race conditions where multiple concurrent bids exceed budget
    const updatedHouse = await Houses.reserveBudget(houseId, amount);
    
    if (!updatedHouse) {
      // Budget reservation failed - insufficient credits
      // Fetch current budget for error message
      const house = await Houses.getById(houseId);
      return NextResponse.json(
        {
          success: false,
          error: "INSUFFICIENT_CREDITS",
          message: `You have ${house?.remainingBudget || 0} credits remaining, but bid ${amount}`,
        },
        { status: 409 }
      );
    }

    // Create the bid with proper ObjectId conversion
    const bid = {
      roundId: new ObjectId(roundId.toString()),
      houseId: new ObjectId(houseId.toString()),
      participantId: new ObjectId(round.participantId.toString()),
      amount: Number(amount),
      timestamp: new Date(),
      edits: 0,
    };

    try {
      const result = await Bids.create(bid);

      return NextResponse.json({
        success: true,
        bidId: result.insertedId.toString(),
        remainingBudget: updatedHouse.remainingBudget,
        message: "Bid submitted successfully",
      });
    } catch (bidError) {
      // If bid creation fails, restore the budget
      console.error("Bid creation failed, restoring budget:", bidError);
      await Houses.restoreBudget(houseId, amount);
      
      return NextResponse.json(
        {
          success: false,
          error: "BID_CREATION_FAILED",
          message: "Failed to create bid. Budget has been restored.",
        },
        { status: 500 }
      );
    }
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
