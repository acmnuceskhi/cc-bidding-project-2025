import { NextRequest, NextResponse } from "next/server";
import { Teams } from "@/lib/models/teams";
import { Participants } from "@/lib/models/participants";
import { verifyAuth } from "@/lib/auth";

// GET /api/teams - Get all teams
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

    const teams = await Teams.getAll();

    // Transform to include only required fields and fetch team members
    const filteredTeams = await Promise.all(
      teams.map(async (team) => {
        // Get participants for this team
        const allParticipants = await Participants.getAll();
        const teamMembers = allParticipants.filter(
          (p) => p.teamId?.toString() === team._id?.toString()
        );

        return {
          teamId: team._id?.toString(),
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
          })),
        };
      })
    );

    return NextResponse.json(filteredTeams);
  } catch (error) {
    console.error("Error fetching teams:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/teams - Create a new team (admin only)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      rank,
      batch,
      successfulAttempts,
      unsuccessfulAttempts,
      totalPoints,
      totalPenalty,
      timeTakenPerProblem,
    } = body;

    // Validate input
    if (!rank || rank < 1) {
      return NextResponse.json(
        { error: "Missing or invalid required field: rank (must be >= 1)" },
        { status: 400 }
      );
    }

    // Create the team
    const team = {
      rank,
      batch: batch || null,
      successfulAttempts: successfulAttempts || 0,
      unsuccessfulAttempts: unsuccessfulAttempts || 0,
      totalPoints: totalPoints || 0,
      totalPenalty: totalPenalty || 0,
      timeTakenPerProblem: timeTakenPerProblem || [],
    };

    const result = await Teams.create(team);

    return NextResponse.json({
      success: true,
      team: {
        ...team,
        _id: result.insertedId,
      },
    });
  } catch (error) {
    console.error("Error creating team:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
