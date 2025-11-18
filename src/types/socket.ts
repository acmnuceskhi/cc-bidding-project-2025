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

export interface ServerToClientEvents {
  "state-update": (state: AppState) => void;
  "round-started": (data: RoundStartedEvent) => void;
  "round-ended": (data: RoundEndedEvent) => void;
  "bid-notification": (data: BidNotificationEvent) => void;
  "auction-state": (data: AuctionState) => void;
  "budget-update": (data: { houseId: string; remainingBudget: number }) => void;
  "bids-update": (
    data:
      | {
        teamId: string;
        bids: Array<{
          houseId: string;
          houseName?: string;
          amount: number;
          timestamp?: string;
        }>;
      } // admin payload
      | { teamId: string; houseId: string; amount: number; timestamp?: string } // house payload
  ) => void;
  "teams-update": (data: { teams: Array<{ teamId: string; name?: string | null; rank: number; batch?: string | null; houseId?: string | null }> }) => void;
  "house-teams-update": (data: { houseId: string; teams: Array<{ teamId: string; name?: string | null; rank: number; batch?: string | null }> }) => void;
  "config-update": (data: {
    maxTeamsPerBatch: number;
    batchLimits?: Record<string, number> | null;
    roundDurationSeconds: number;
    countdownWarningSeconds: number;
    autoStartNextRound: boolean;
    delayBetweenRoundsSeconds: number;
    currentRound?: string;
    auctionStartTime?: string | null;
    auctionEndTime?: string | null;
    currentRoundStartTime?: string | null;
    currentRoundEndTime?: string | null;
  }) => void;
}

export interface ClientToServerEvents {
  "bid-placed": (data: BidPlacedEvent) => void;
  "request-state": (ack?: (data: AuctionState) => void) => void;
}

// Canonical auction-state payload pushed from server
export interface AuctionState {
  currentRound: string;
  auctionStartTime: string | null; // ISO string or null
  auctionEndTime: string | null; // ISO string or null
  currentRoundStartTime: string | null; // ISO string or null
  currentRoundEndTime: string | null; // ISO string or null
  serverTime: number; // ms epoch
}
