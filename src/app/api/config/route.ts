import { NextRequest, NextResponse } from "next/server";
import { Config } from "@/lib/models/config";
import { emitSocketEvent } from "@/lib/socket-instance";
import { verifyAuth, hasRole } from "@/lib/auth";

// GET /api/config - Get current configuration (public for display)
export async function GET() {
  try {
    const cfg = await Config.get();
    // Ensure all date fields are serialized as ISO strings or null for reliable client parsing
    const safe = {
      ...cfg,
      auctionStartTime: cfg.auctionStartTime
        ? cfg.auctionStartTime.toISOString()
        : null,
      auctionEndTime: cfg.auctionEndTime
        ? cfg.auctionEndTime.toISOString()
        : null,
      currentRoundStartTime: cfg.currentRoundStartTime
        ? cfg.currentRoundStartTime.toISOString()
        : null,
      currentRoundEndTime: cfg.currentRoundEndTime
        ? cfg.currentRoundEndTime.toISOString()
        : null,
    };
    return NextResponse.json(safe);
  } catch (error) {
    console.error("Error fetching config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/config - Update configuration (admin only)
export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Only admins can update config
    if (!hasRole(authResult.payload, "admin")) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      maxTeamsPerBatch,
      maxBidAmount,
      roundDurationSeconds,
      countdownWarningSeconds,
      autoStartNextRound,
      delayBetweenRoundsSeconds,
      // Authoritative auction state fields
      currentRound,
      auctionStartTime,
      auctionEndTime,
      currentRoundStartTime,
      currentRoundEndTime,
    } = body;

    const update: any = {};

    // Validate and add fields
    if (maxTeamsPerBatch !== undefined) {
      if (
        typeof maxTeamsPerBatch !== "number" ||
        maxTeamsPerBatch < 1 ||
        maxTeamsPerBatch > 10
      ) {
        return NextResponse.json(
          { error: "maxTeamsPerBatch must be a number between 1 and 10" },
          { status: 400 }
        );
      }
      update.maxTeamsPerBatch = maxTeamsPerBatch;
    }

    if (roundDurationSeconds !== undefined) {
      if (
        typeof roundDurationSeconds !== "number" ||
        roundDurationSeconds < 30 ||
        roundDurationSeconds > 600
      ) {
        return NextResponse.json(
          { error: "roundDurationSeconds must be a number between 30 and 600" },
          { status: 400 }
        );
      }
      update.roundDurationSeconds = roundDurationSeconds;
    }

    // Validate maxBidAmount (null = unlimited)
    if (maxBidAmount !== undefined) {
      const isNull = maxBidAmount === null;
      const isValidNumber =
        typeof maxBidAmount === "number" &&
        Number.isFinite(maxBidAmount) &&
        maxBidAmount >= 1 &&
        maxBidAmount <= 1_000_000_000; // practical upper bound
      if (!isNull && !isValidNumber) {
        return NextResponse.json(
          {
            error:
              "maxBidAmount must be null or a number between 1 and 1000000000",
          },
          { status: 400 }
        );
      }
      update.maxBidAmount = maxBidAmount;
    }

    if (countdownWarningSeconds !== undefined) {
      if (
        typeof countdownWarningSeconds !== "number" ||
        countdownWarningSeconds < 5 ||
        countdownWarningSeconds > 60
      ) {
        return NextResponse.json(
          {
            error: "countdownWarningSeconds must be a number between 5 and 60",
          },
          { status: 400 }
        );
      }
      update.countdownWarningSeconds = countdownWarningSeconds;
    }

    if (autoStartNextRound !== undefined) {
      if (typeof autoStartNextRound !== "boolean") {
        return NextResponse.json(
          { error: "autoStartNextRound must be a boolean" },
          { status: 400 }
        );
      }
      update.autoStartNextRound = autoStartNextRound;
    }

    if (delayBetweenRoundsSeconds !== undefined) {
      if (
        typeof delayBetweenRoundsSeconds !== "number" ||
        delayBetweenRoundsSeconds < 0 ||
        delayBetweenRoundsSeconds > 60
      ) {
        return NextResponse.json(
          {
            error:
              "delayBetweenRoundsSeconds must be a number between 0 and 60",
          },
          { status: 400 }
        );
      }
      update.delayBetweenRoundsSeconds = delayBetweenRoundsSeconds;
    }

    // Optional: validate and add the five authoritative fields
    if (currentRound !== undefined) {
      if (typeof currentRound !== "string") {
        return NextResponse.json(
          { error: "currentRound must be a string" },
          { status: 400 }
        );
      }
      update.currentRound = currentRound;
    }

    const isValidDateInput = (v: unknown) =>
      v === null ||
      v === undefined ||
      v instanceof Date ||
      typeof v === "string" ||
      typeof v === "number";

    if (auctionStartTime !== undefined) {
      if (!isValidDateInput(auctionStartTime)) {
        return NextResponse.json(
          {
            error:
              "auctionStartTime must be a Date, ISO string, number, null or undefined",
          },
          { status: 400 }
        );
      }
      update.auctionStartTime = auctionStartTime;
    }
    if (auctionEndTime !== undefined) {
      if (!isValidDateInput(auctionEndTime)) {
        return NextResponse.json(
          {
            error:
              "auctionEndTime must be a Date, ISO string, number, null or undefined",
          },
          { status: 400 }
        );
      }
      update.auctionEndTime = auctionEndTime;
    }
    if (currentRoundStartTime !== undefined) {
      if (!isValidDateInput(currentRoundStartTime)) {
        return NextResponse.json(
          {
            error:
              "currentRoundStartTime must be a Date, ISO string, number, null or undefined",
          },
          { status: 400 }
        );
      }
      update.currentRoundStartTime = currentRoundStartTime;
    }
    if (currentRoundEndTime !== undefined) {
      if (!isValidDateInput(currentRoundEndTime)) {
        return NextResponse.json(
          {
            error:
              "currentRoundEndTime must be a Date, ISO string, number, null or undefined",
          },
          { status: 400 }
        );
      }
      update.currentRoundEndTime = currentRoundEndTime;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Update config
    await Config.update(update);

    // Get updated auction state for broadcast
    const updatedConfig = await Config.getAuctionState();

    // Broadcast updated state to all clients via sockets
    emitSocketEvent("auction-state", {
      currentRound: updatedConfig.currentRound || "",
      auctionStartTime: updatedConfig.auctionStartTime?.toISOString() || null,
      auctionEndTime: updatedConfig.auctionEndTime?.toISOString() || null,
      currentRoundStartTime:
        updatedConfig.currentRoundStartTime?.toISOString() || null,
      currentRoundEndTime:
        updatedConfig.currentRoundEndTime?.toISOString() || null,
      serverTime: Date.now(),
    });

    return NextResponse.json({
      success: true,
      config: await Config.get(),
    });
  } catch (error: any) {
    console.error("Error updating config:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
