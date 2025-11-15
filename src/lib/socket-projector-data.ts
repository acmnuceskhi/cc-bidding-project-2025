import { Rounds } from "@/lib/models/rounds";
import { Teams } from "@/lib/models/teams";
import { Participants } from "@/lib/models/participants";
import { Bids } from "@/lib/models/bids";
import { Houses } from "@/lib/models/houses";

export interface ProjectorStatus {
  roundId: string | null;
  team: {
    teamId: string;
    rank: number;
    batch: string | null;
    memberCount: number;
    successfulAttempts?: number;
    totalPoints?: number;
  } | null;
  roundStatus: "active" | "idle";
  roundNumber?: number;
  timerRemaining: number;
  timerEnd?: string;
  bidsPlaced: Array<{ houseId: string; amount: number }>;
  roundEnded?: boolean;
  winner?: {
    houseName: string;
    amount: number;
  };
}

export interface ProjectorHouse {
  _id: string;
  houseId: string;
  name: string;
  remainingBudget: number;
  totalBudget: number;
}

export interface ProjectorUpdate {
  status: ProjectorStatus;
  houses: ProjectorHouse[];
}

/**
 * Builds full projector data (status + houses) for socket events
 * This eliminates the need for clients to make HTTP requests when socket is connected
 */
export async function buildProjectorData(): Promise<ProjectorUpdate> {
  try {
    // Get all houses
    const houses = await Houses.getAll();
    const housesData: ProjectorHouse[] = houses.map((house) => ({
      _id: house._id?.toString() || "",
      houseId: house._id?.toString() || "",
      name: house.name,
      remainingBudget: house.remainingBudget,
      totalBudget: house.totalBudget,
    }));

    // Get all participants for member count calculation
    const allParticipants = await Participants.getAll();
    const getMemberCount = (teamId: string) => {
      return allParticipants.filter((p) => p.teamId?.toString() === teamId)
        .length;
    };

    // Get active rounds
    const activeRounds = await Rounds.getActive();

    if (activeRounds.length === 0) {
      return {
        status: {
          roundId: null,
          team: null,
          roundStatus: "idle",
          timerRemaining: 0,
          bidsPlaced: [],
        },
        houses: housesData,
      };
    }

    const activeRound = activeRounds[0];

    // Fetch team info
    const team = await Teams.getById(activeRound.teamId.toString());

    // Fetch all bids for the current round
    const roundBids = await Bids.getByRound(activeRound._id!.toString());

    // Calculate remaining time
    const currentTime = Date.now();
    const roundTimerEnd = activeRound.timerEnd?.getTime();
    const timerRemaining = roundTimerEnd
      ? Math.max(0, Math.floor((roundTimerEnd - currentTime) / 1000))
      : 0;

    // Collect houses that have placed bids with amounts
    const bidsPlaced = roundBids.map((bid) => ({
      houseId: bid.houseId.toString(),
      amount: bid.amount,
    }));

    // Calculate round number from phase counts
    const allRounds = await Rounds.getAll();
    const phaseCounts = {
      pass1: { total: 0, scheduled: 0, active: 0, completed: 0 },
      pass2: { total: 0, scheduled: 0, active: 0, completed: 0 },
    };

    for (const r of allRounds) {
      const phaseKey = (r.passPhase === 2 ? "pass2" : "pass1") as
        | "pass1"
        | "pass2";
      phaseCounts[phaseKey].total += 1;
      if (r.status === "scheduled") phaseCounts[phaseKey].scheduled += 1;
      else if (r.status === "active") phaseCounts[phaseKey].active += 1;
      else if (r.status === "completed") phaseCounts[phaseKey].completed += 1;
    }

    const roundNumber =
      phaseCounts.pass1.completed +
      phaseCounts.pass2.completed +
      phaseCounts.pass1.active +
      phaseCounts.pass2.active;

    // Check if round has ended (status is completed or timer expired)
    const roundEnded = activeRound.status === "completed" || timerRemaining <= 0;

    // Get winner if round ended
    let winner: { houseName: string; amount: number } | undefined;
    if (roundEnded && roundBids.length > 0) {
      const winningBid = roundBids.reduce((winner, current) => {
        if (current.amount > winner.amount) return current;
        if (
          current.amount === winner.amount &&
          current.timestamp < winner.timestamp
        )
          return current;
        return winner;
      });

      const winningHouse = await Houses.getById(winningBid.houseId.toString());
      if (winningHouse) {
        winner = {
          houseName: winningHouse.name,
          amount: winningBid.amount,
        };
      }
    }

    const status: ProjectorStatus = {
      roundId: activeRound._id?.toString() || null,
      team: team
        ? {
            teamId: team._id?.toString(),
            rank: team.rank,
            batch: team.batch ?? null,
            memberCount: getMemberCount(team._id?.toString() || ""),
            successfulAttempts: team.successfulAttempts,
            totalPoints: team.totalPoints,
          }
        : null,
      roundStatus: activeRound.status === "active" ? "active" : "idle",
      roundNumber,
      timerRemaining,
      timerEnd: activeRound.timerEnd?.toISOString(),
      bidsPlaced,
      roundEnded,
      winner,
    };

    return {
      status,
      houses: housesData,
    };
  } catch (error) {
    console.error("Error building projector data:", error);
    // Return empty state on error
    const houses = await Houses.getAll();
    const housesData: ProjectorHouse[] = houses.map((house) => ({
      _id: house._id?.toString() || "",
      houseId: house._id?.toString() || "",
      name: house.name,
      remainingBudget: house.remainingBudget,
      totalBudget: house.totalBudget,
    }));

    return {
      status: {
        roundId: null,
        team: null,
        roundStatus: "idle",
        timerRemaining: 0,
        bidsPlaced: [],
      },
      houses: housesData,
    };
  }
}

