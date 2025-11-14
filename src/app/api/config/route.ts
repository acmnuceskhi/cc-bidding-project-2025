import { NextRequest, NextResponse } from "next/server";
import { Config } from "@/lib/models/config";
import { verifyAuth, hasRole } from "@/lib/auth";

// GET /api/config - Get current configuration (public for display)
export async function GET() {
  try {
    const config = await Config.get();
    return NextResponse.json(config);
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
      roundDurationSeconds,
      countdownWarningSeconds,
      autoStartNextRound,
      delayBetweenRoundsSeconds,
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

    if (countdownWarningSeconds !== undefined) {
      if (
        typeof countdownWarningSeconds !== "number" ||
        countdownWarningSeconds < 5 ||
        countdownWarningSeconds > 60
      ) {
        return NextResponse.json(
          { error: "countdownWarningSeconds must be a number between 5 and 60" },
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
            error: "delayBetweenRoundsSeconds must be a number between 0 and 60",
          },
          { status: 400 }
        );
      }
      update.delayBetweenRoundsSeconds = delayBetweenRoundsSeconds;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Update config
    await Config.update(update);

    // Get updated config
    const updatedConfig = await Config.get();

    return NextResponse.json({
      success: true,
      config: updatedConfig,
    });
  } catch (error: any) {
    console.error("Error updating config:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
