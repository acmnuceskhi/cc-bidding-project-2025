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
      minBidAmount,
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
    // Support legacy scalar `maxTeamsPerBatch` (fallback) and new `batchLimits` object
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

    if ((body as any).batchLimits !== undefined) {
      const batchLimits = (body as any).batchLimits;
      if (typeof batchLimits !== "object" || Array.isArray(batchLimits) || batchLimits === null) {
        return NextResponse.json({ error: "batchLimits must be an object mapping batch->number" }, { status: 400 });
      }
      const allowedBatches = ["2022", "2023", "2024", "2025"];
      const validated: Record<string, number> = {};
      for (const [k, v] of Object.entries(batchLimits)) {
        if (!allowedBatches.includes(k)) {
          return NextResponse.json({ error: `Invalid batch key: ${k}` }, { status: 400 });
        }
        if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 10) {
          return NextResponse.json({ error: `Batch limit for ${k} must be a number between 0 and 10` }, { status: 400 });
        }
        validated[k] = v;
      }
      update.batchLimits = validated;
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

    // Note: server-side configured per-bid hard cap has been removed.
    // Max bid is computed from the house budget and batch/team limits only.

    // Validate minBidAmount (null allowed)
    if (minBidAmount !== undefined) {
      const isNull = minBidAmount === null;
      const isValidNumber =
        typeof minBidAmount === "number" &&
        Number.isFinite(minBidAmount) &&
        minBidAmount >= 0 &&
        minBidAmount <= 1_000_000_000;
      if (!isNull && !isValidNumber) {
        return NextResponse.json(
          { error: "minBidAmount must be null or a non-negative number" },
          { status: 400 }
        );
      }
      update.minBidAmount = minBidAmount;
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

    // Broadcast updated state to all clients via sockets (auction-state) and full config (config-update)
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

    // Also broadcast the full config object to clients so they can react to per-batch limits
    try {
      const cfgFull = await Config.get();
      const safe = {
        ...cfgFull,
        auctionStartTime: cfgFull.auctionStartTime ? cfgFull.auctionStartTime.toISOString() : null,
        auctionEndTime: cfgFull.auctionEndTime ? cfgFull.auctionEndTime.toISOString() : null,
        currentRoundStartTime: cfgFull.currentRoundStartTime ? cfgFull.currentRoundStartTime.toISOString() : null,
        currentRoundEndTime: cfgFull.currentRoundEndTime ? cfgFull.currentRoundEndTime.toISOString() : null,
      };
      emitSocketEvent("config-update", safe);
    } catch (e) {
      // non-fatal
    }

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
