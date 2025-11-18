import { NextRequest, NextResponse } from "next/server";
import { Bids } from "@/lib/models/bids";
import { Houses } from "@/lib/models/houses";
import { Teams } from "@/lib/models/teams";
import { Config } from "@/lib/models/config";
import { verifyAuth } from "@/lib/auth";
import { emitSocketEvent, getSocketInstance } from "@/lib/socket-instance";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logger } from "@/lib/logger";
import { getCachedCollection } from "@/lib/cache";

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
    if (
      !cfg.currentRoundStartTime ||
      !cfg.currentRoundEndTime ||
      now < cfg.currentRoundStartTime ||
      now > cfg.currentRoundEndTime
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "WINDOW_CLOSED",
          message: "Bidding window is not active",
        },
        { status: 400 }
      );
    }

    // Note: per-bid `maxBidAmount` is no longer enforced as a standalone
    // static cap here. We compute a conservative per-house `computedMax`
    // (below) that incorporates `minBidAmount`, remaining budget, and
    // per-batch limits — that value will be used to validate bid amounts.

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

    // 👥 Get count of teams in same batch and config (PERF: uses targeted DB count query + caching)
    const [sameBatchCount, config] = await Promise.all([
      Teams.countByHouseAndBatch(houseId, teamBatch),
      getCachedCollection('config', () => Config.get(), 30000),
    ]);

    // 🏷️ In second pass, minimum roster check removed (team-based bidding)

    // Compute per-batch limit (batch-specific overrides legacy scalar)
    const perBatchLimit =
      (config.batchLimits && config.batchLimits[teamBatch]) ?? 1;

    // How many more teams from this batch the house may win
    const teamsLeftToBuy = Math.max(0, perBatchLimit - sameBatchCount);

    // If no slots left in this batch, reject
    if (teamsLeftToBuy <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "BATCH_LIMIT_REACHED",
          message: `House '${house.name}' already has the maximum (${perBatchLimit}) teams from batch '${teamBatch}'.`,
        },
        { status: 403 }
      );
    }

    // Minimum allowed bid (server-configurable). Default to 1 when not set.
    const minBid = config.minBidAmount == null ? 1 : Number(config.minBidAmount);

    if (amount < minBid) {
      return NextResponse.json(
        {
          success: false,
          error: "MIN_BID_NOT_MET",
          message: `Bid must be at least ${minBid}`,
        },
        { status: 409 }
      );
    }

    // Compute a conservative per-house maximum to ensure the house can still afford
    // the remaining required purchases from this batch. If only 1 slot remains,
    // the house may spend their entire remaining budget on this purchase.
    let computedMax = house.remainingBudget;
    if (teamsLeftToBuy > 1) {
      computedMax = house.remainingBudget - (teamsLeftToBuy - 1) * minBid;
    }
    computedMax = Math.max(0, computedMax);

    // If computedMax is below the minimum allowed bid, there is no affordable bid
    if (computedMax < minBid) {
      return NextResponse.json(
        {
          success: false,
          error: "COMPUTED_MAX_TOO_LOW",
          message: `Insufficient funds to safely acquire remaining ${teamsLeftToBuy} team(s) from batch '${teamBatch}'.`,
        },
        { status: 409 }
      );
    }

    if (amount > computedMax) {
      return NextResponse.json(
        {
          success: false,
          error: "COMPUTED_MAX_EXCEEDED",
          message: `Bid of ${amount} exceeds your computed safe maximum of ${computedMax}. Reduce bid to at most ${computedMax}.`,
        },
        { status: 409 }
      );
    }

    const isNew: boolean = previousAmount === null || previousAmount === undefined;

    // Enforce beating the current highest bid across all houses for this team
    try {
      const client = await clientPromise;
      const existingOwn = await client
        .db()
        .collection("bids")
        .findOne({
          roundId: new ObjectId(rawTeamId),
          houseId: new ObjectId(houseId),
        });
      // Find current highest bid amount for this team across all houses
      const highest = await client
        .db()
        .collection("bids")
        .find({ roundId: new ObjectId(rawTeamId) })
        .sort({ amount: -1, timestamp: 1 })
        .limit(1)
        .toArray();
      const highestAmount = highest && highest.length > 0 ? highest[0].amount : 0;

      if (amount <= highestAmount) {
        return NextResponse.json(
          {
            success: false,
            error: "BID_NOT_HIGHEST",
            message: `New bid must be higher than the current highest bid of ${highestAmount}`,
          },
          { status: 409 }
        );
      }
    } catch (err) {
      // If checking existing bid fails, be safe and reject
      return NextResponse.json(
        {
          success: false,
          error: "VALIDATION_FAILED",
          message: "Failed to validate existing bid. Please try again.",
        },
        { status: 500 }
      );
    }

    // Always delete any pre-existing bid from this house for this team
    // Then insert a fresh bid document (ensures clean state and fresh timestamp)
    const client = await clientPromise;
    await client
      .db()
      .collection("bids")
      .deleteMany({
        roundId: new ObjectId(rawTeamId),
        houseId: new ObjectId(houseId),
      });

    // Insert or upsert the new bid (no budget deduction here)
    // teamId doubles as roundId in the round-less design
    await Bids.upsertBid(rawTeamId, houseId, rawTeamId, amount);

    // Emit socket event to notify all clients of the bid
    emitSocketEvent("bid-placed", {
      houseId,
      houseName: house.name,
      // Back-compat: event field name remains roundId but carries teamId
      roundId: rawTeamId,
    });

    // Enriched push updates
    try {
      const io = getSocketInstance();
      if (io) {
        // Admin sees all latest bids for current team
        const latestBids = await Bids.getByTeam(rawTeamId);
        // PERF FIX: Use lightweight ID-name map instead of full house documents
        const houseNameById = await Houses.getIdNameMap();
        const adminBids = latestBids
          .map((b) => ({
            houseId: b.houseId.toString(),
            houseName: houseNameById.get(b.houseId.toString()) || "Unknown",
            amount: b.amount,
            timestamp: b.timestamp
              ? new Date(b.timestamp).toISOString()
              : new Date().toISOString(),
          }))
          .sort((a, b) => b.amount - a.amount);
        io.to("admins").emit("bids-update", {
          teamId: rawTeamId,
          bids: adminBids,
        });

        // PERF FIX: Removed redundant global broadcast - targeted rooms sufficient
        // Projector gets updates via bid-placed event, admins via room, houses via room

        // House sees only its own latest bid
        io.to(`house:${houseId}`).emit("bids-update", {
          teamId: rawTeamId,
          houseId,
          amount,
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // Non-fatal; API success should not depend on socket delivery
    }

    return NextResponse.json({
      success: true,
      remainingBudget: house.remainingBudget,
      message: isNew ? "Bid placed successfully" : "Bid updated successfully",
      previousAmount,
      newAmount: amount,
    });
  } catch (error) {
    logger.error("Error creating bid:", error);
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
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");
    const houseId = searchParams.get("houseId");
    const roundId = searchParams.get("roundId");

    // Public access: Allow fetching bids by teamId/roundId (for projector/public display)
    if (roundId || teamId) {
      const bids = await Bids.getByTeam(roundId || teamId!);
      return NextResponse.json(bids);
    }

    // Authenticated access required for house-specific or all-bids queries
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { payload } = authResult;
    let bids;

    if (houseId) {
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
    logger.error("Error fetching bids:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
