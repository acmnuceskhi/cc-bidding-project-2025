import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, hasRole } from "@/lib/auth";
import { Teams } from "@/lib/models/teams";
import { Houses } from "@/lib/models/houses";
import { Config } from "@/lib/models/config";
import { ObjectId } from "mongodb";

// GET /api/admin/assign-team/limits?houseId=...&teamId=...
// Returns minBid and computed safe max for either a specific team+house or
// for all batches for the given house so admins can see allowed ranges.
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (!hasRole(auth.payload, "admin")) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const url = new URL(request.url);
    const houseId = url.searchParams.get("houseId");
    const teamId = url.searchParams.get("teamId");

    if (!houseId) return NextResponse.json({ error: "MISSING_FIELDS", message: "houseId query param is required" }, { status: 400 });

    const house = await Houses.getById(houseId);
    if (!house) return NextResponse.json({ error: "HOUSE_NOT_FOUND" }, { status: 404 });

    const cfg = await Config.get();
    const minBid = cfg.minBidAmount == null ? 1 : Number(cfg.minBidAmount);

    // Helper to compute for a given batch
    const computeForBatch = (batch: string) => {
      // How many teams from this batch does the house already have?
      // We'll compute sameBatchCount at call site where we have all teams.
      return {
        minBid,
      };
    };

    // If teamId provided, compute specifically for that team's batch
    if (teamId) {
      const team = await Teams.getById(teamId);
      if (!team) return NextResponse.json({ error: "TEAM_NOT_FOUND" }, { status: 404 });
      const allTeams = await Teams.getAll();
      const sameBatchCount = allTeams.filter((t) => t.houseId && t.houseId.toString() === houseId && t.batch === team.batch).length;
      const perBatchLimit = (cfg.batchLimits && cfg.batchLimits[team.batch as string]) ?? 1;
      const teamsLeftToBuy = Math.max(0, perBatchLimit - sameBatchCount);
      let computedMax = house.remainingBudget;
      if (teamsLeftToBuy > 1) computedMax = house.remainingBudget - (teamsLeftToBuy - 1) * minBid;
      computedMax = Math.max(0, computedMax);

      return NextResponse.json({
        houseId,
        remainingBudget: house.remainingBudget,
        batch: team.batch || null,
        perBatchLimit,
        sameBatchCount,
        teamsLeftToBuy,
        minBid,
        computedMax,
      });
    }

    // Otherwise compute for all batches found in teams' data
    const allTeams = await Teams.getAll();
    const batches = Array.from(new Set(allTeams.map((t) => t.batch).filter(Boolean))) as string[];
    const result: Record<string, any> = {};
    for (const batch of batches) {
      const sameBatchCount = allTeams.filter((t) => t.houseId && t.houseId.toString() === houseId && t.batch === batch).length;
      const perBatchLimit = (cfg.batchLimits && cfg.batchLimits[batch]) ?? 1;
      const teamsLeftToBuy = Math.max(0, perBatchLimit - sameBatchCount);
      let computedMax = house.remainingBudget;
      if (teamsLeftToBuy > 1) computedMax = house.remainingBudget - (teamsLeftToBuy - 1) * minBid;
      computedMax = Math.max(0, computedMax);
      result[batch] = { perBatchLimit, sameBatchCount, teamsLeftToBuy, minBid, computedMax };
    }

    return NextResponse.json({ houseId, remainingBudget: house.remainingBudget, batches: result });
  } catch (error) {
    console.error("Error in GET /api/admin/assign-team/limits:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
