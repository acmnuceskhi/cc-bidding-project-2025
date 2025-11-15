export type ScreenType = "waiting" | "bidding" | "results";

export interface WaitingState {
  screen: "waiting";
  message: string;
}

export interface BiddingState {
  screen: "bidding";
  roundId: string;
  teamId: string;
  timeLeft: number;
}

export interface Winner {
  houseId: string;
  houseName: string;
  amount: number;
  timestamp: string;
}

export interface LoserBid {
  houseId: string;
  amount: number;
  timestamp: string;
}

export interface ResultsState {
  screen: "results";
  roundId: string;
  winner: Winner | null;
  losers: LoserBid[];
}

export type AppState = WaitingState | BiddingState | ResultsState;

export interface RoundStartedEvent {
  roundId: string;
  timerEnd: string;
}

export interface RoundEndedEvent {
  roundId: string;
  winner: Winner | null;
  losers: LoserBid[];
}

export interface BidNotificationEvent {
  houseId: string;
  houseName: string;
  roundId: string;
}

export interface BidPlacedEvent {
  houseId: string;
  houseName: string;
  roundId: string;
}

export interface ProjectorUpdateEvent {
  status: {
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
  };
  houses: Array<{
    _id: string;
    houseId: string;
    name: string;
    remainingBudget: number;
    totalBudget: number;
  }>;
}

export interface ServerToClientEvents {
  "state-update": (state: AppState) => void;
  "round-started": (data: RoundStartedEvent) => void;
  "round-ended": (data: RoundEndedEvent) => void;
  "bid-notification": (data: BidNotificationEvent) => void;
  "projector-update": (data: ProjectorUpdateEvent) => void;
}

export interface ClientToServerEvents {
  "bid-placed": (data: BidPlacedEvent) => void;
}

