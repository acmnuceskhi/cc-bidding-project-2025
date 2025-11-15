import { NextRequest, NextResponse } from "next/server";
import { Teams } from "@/lib/models/teams";
import { Participants } from "@/lib/models/participants";
import { verifyAuth, hasRole } from "@/lib/auth";
import { ObjectId } from "mongodb";

// GET /api/teams/[id] - Get a specific team
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid team ID" },
        { status: 400 }
      );
    }

    const team = await Teams.getById(id);

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Get participants for this team
    const allParticipants = await Participants.getAll();
    const teamMembers = allParticipants.filter(
      (p) => p.teamId?.toString() === team._id?.toString()
    );

    return NextResponse.json({
      teamId: team._id?.toString(),
      name: team.name || null,
      rank: team.rank,
      batch: team.batch || null,
      successfulAttempts: team.successfulAttempts,
      unsuccessfulAttempts: team.unsuccessfulAttempts,
      totalPoints: team.totalPoints,
      totalPenalty: team.totalPenalty,
      timeTakenPerProblem: team.timeTakenPerProblem,
      houseId: team.houseId ? team.houseId.toString() : null,
      memberCount: teamMembers.length,
      members: teamMembers.map((p) => ({
        participantId: p._id?.toString(),
        name: p.name,
        picture: p.picture || null,
        rollNumber: p.rollNumber,
      })),
    });
  } catch (error) {
    console.error("Error fetching team:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/teams/[id] - Update a team (admin only)
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
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

    const { id } = await context.params;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid team ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      name,
      rank,
      batch,
      successfulAttempts,
      unsuccessfulAttempts,
      totalPoints,
      totalPenalty,
      timeTakenPerProblem,
    } = body;

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (rank !== undefined) updateData.rank = rank;
    if (batch !== undefined) updateData.batch = batch;
    if (successfulAttempts !== undefined)
      updateData.successfulAttempts = successfulAttempts;
    if (unsuccessfulAttempts !== undefined)
      updateData.unsuccessfulAttempts = unsuccessfulAttempts;
    if (totalPoints !== undefined) updateData.totalPoints = totalPoints;
    if (totalPenalty !== undefined) updateData.totalPenalty = totalPenalty;
    if (timeTakenPerProblem !== undefined)
      updateData.timeTakenPerProblem = timeTakenPerProblem;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const result = await Teams.update(id, updateData);

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Team updated successfully",
    });
  } catch (error) {
    console.error("Error updating team:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[id] - Delete a team (admin only)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
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

    const { id } = await context.params;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid team ID" },
        { status: 400 }
      );
    }

    const result = await Teams.delete(id);

    if (!result) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Team deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting team:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
