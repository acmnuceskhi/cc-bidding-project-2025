import { NextRequest, NextResponse } from "next/server";
import { Teams } from "@/lib/models/teams";
import { Participants } from "@/lib/models/participants";
import { Houses } from "@/lib/models/houses";
import clientPromise from "@/lib/mongodb";
import { verifyAuth, hasRole } from "@/lib/auth";
import { ObjectId } from "mongodb";
import { getSocketInstance } from "@/lib/socket-instance";

// POST /api/teams/[id]/release - Release a recruited team and refund the house
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ Authentication & role check
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (!hasRole(authResult.payload, "admin")) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // ✅ Validate team ID
    const { id } = await context.params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid or missing team ID" },
        { status: 400 }
      );
    }

    const team = await Teams.getById(id);
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // ✅ Check if team is recruited
    if (!team.houseId) {
      return NextResponse.json(
        { error: "Team is not recruited and cannot be released" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const session = client.startSession();
    const lockKey = `release-team-${id}`;
    const locksColl = client
      .db()
      .collection<{ _id: string; createdAt: Date }>("_locks");

    // Try to acquire a lock to prevent concurrent releases
    try {
      await locksColl.insertOne({ _id: lockKey, createdAt: new Date() });
    } catch (err: unknown) {
      const e = err as { code?: number; codeName?: string };
      if (e && (e.code === 11000 || e.codeName === "DuplicateKey")) {
        return NextResponse.json({
          success: false,
          error: "Release already in progress for this team",
        });
      }
      throw err;
    }

    let refundAmount = 0;
    let houseName = "";
    let refundedHouseId = "";

    try {
      await session.withTransaction(async () => {
        const db = client.db();

        // Re-read team inside transaction to ensure current state
        const teamDoc = await db
          .collection("teams")
          .findOne({ _id: new ObjectId(id) }, { session });

        if (!teamDoc?.houseId) {
          throw new Error("Team is not currently assigned to a house");
        }

        refundedHouseId = teamDoc.houseId.toString();

        // Get house details for response
        const house = await db
          .collection("houses")
          .findOne({ _id: new ObjectId(refundedHouseId) }, { session });

        if (!house) {
          throw new Error("House not found");
        }

        houseName = house.name;

        // Find all bids for this team
        const teamBids = await db
          .collection("bids")
          .find({ teamId: new ObjectId(id) }, { session })
          .toArray();

        // Find the winning bid (highest amount, earliest timestamp for ties)
        let winningBid = null;
        if (teamBids.length > 0) {
          winningBid = teamBids.sort((a, b) => {
            if (b.amount !== a.amount) return b.amount - a.amount;
            return (
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
          })[0];
        }

        if (winningBid && winningBid.houseId.toString() === refundedHouseId) {
          refundAmount = winningBid.amount;

          // Refund the budget to the house
          await db
            .collection("houses")
            .updateOne(
              { _id: new ObjectId(refundedHouseId) },
              { $inc: { remainingBudget: refundAmount } },
              { session }
            );
        }

        // Delete all bids for this team
        await db
          .collection("bids")
          .deleteMany({ teamId: new ObjectId(id) }, { session });

        // Unassign the team from the house
        await db
          .collection("teams")
          .updateOne(
            { _id: new ObjectId(id) },
            { $unset: { houseId: "" } },
            { session }
          );

        // Unassign all participants in the team from the house
        await db
          .collection("participants")
          .updateMany(
            { teamId: new ObjectId(id) },
            { $unset: { houseId: "" } },
            { session }
          );

        console.log(
          `[RELEASE] Team ${id} released from house ${houseName}, refunded ${refundAmount}`
        );
      });

      // Release the lock after successful transaction
      await locksColl.deleteOne({ _id: lockKey });

      // ✅ Emit socket events for real-time updates
      const io = getSocketInstance();
      if (io && refundedHouseId) {
        const updatedHouse = await Houses.getById(refundedHouseId);
        if (updatedHouse) {
          // Emit budget-update to the affected house room
          io.to(`house:${refundedHouseId}`).emit("budget-update", {
            houseId: refundedHouseId,
            totalBudget: updatedHouse.totalBudget,
            remainingBudget: updatedHouse.remainingBudget,
            spent: updatedHouse.totalBudget - updatedHouse.remainingBudget,
          });

          // Also emit to admins room
          io.to("admins").emit("budget-update", {
            houseId: refundedHouseId,
            totalBudget: updatedHouse.totalBudget,
            remainingBudget: updatedHouse.remainingBudget,
            spent: updatedHouse.totalBudget - updatedHouse.remainingBudget,
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: `Team released from ${houseName}`,
        refundAmount,
        houseName,
      });
    } catch (error) {
      // Release the lock on error
      await locksColl.deleteOne({ _id: lockKey });
      throw error;
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error("[RELEASE] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to release team",
      },
      { status: 500 }
    );
  }
}
