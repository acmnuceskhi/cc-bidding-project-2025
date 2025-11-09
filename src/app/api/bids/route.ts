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

    // Allow multiple bids from the same house within the 60-second window
    // When a house places a new bid, it replaces the previous one
    
    // First, check if there's an existing bid and get its amount
    const { previousAmount, isNew } = await Bids.upsertBid(
      roundId,
      houseId,
      round.participantId.toString(),
      amount
    );

    // Calculate the budget difference
    const budgetDifference = amount - previousAmount;

    // If the new bid is higher, we need to reserve more budget
    // If the new bid is lower, we'll restore some budget
    if (budgetDifference > 0) {
      // Need to reserve additional budget
      const updatedHouse = await Houses.reserveBudget(houseId, budgetDifference);
      
      if (!updatedHouse) {
        // Budget reservation failed - insufficient credits
        // Restore the previous bid amount
        if (!isNew) {
          await Bids.upsertBid(
            roundId,
            houseId,
            round.participantId.toString(),
            previousAmount
          );
        }
        
        const house = await Houses.getById(houseId);
        return NextResponse.json(
          {
            success: false,
            error: "INSUFFICIENT_CREDITS",
            message: `You have ${house?.remainingBudget || 0} credits remaining, but need ${budgetDifference} more`,
          },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        remainingBudget: updatedHouse.remainingBudget,
        message: isNew ? "Bid placed successfully" : "Bid updated successfully",
        previousAmount,
        newAmount: amount,
      });
    } else if (budgetDifference < 0) {
      // New bid is lower, restore the difference
      await Houses.restoreBudget(houseId, Math.abs(budgetDifference));
      
      const house = await Houses.getById(houseId);
      return NextResponse.json({
        success: true,
        remainingBudget: house?.remainingBudget || 0,
        message: "Bid updated successfully",
        previousAmount,
        newAmount: amount,
      });
    } else {
      // Same amount, no budget change needed
      const house = await Houses.getById(houseId);
      return NextResponse.json({
        success: true,
        remainingBudget: house?.remainingBudget || 0,
        message: "Bid confirmed",
        previousAmount,
        newAmount: amount,
      });
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
