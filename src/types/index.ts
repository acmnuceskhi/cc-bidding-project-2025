import { ObjectId } from "mongodb";

// Re-export model types for easier imports
export type { House } from "@/lib/models/houses";
export type { Participant } from "@/lib/models/participants";
export type { Round } from "@/lib/models/rounds";
export type { Bid } from "@/lib/models/bids";

// Additional utility types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ProjectorStatus {
  activeRound: {
    id: string;
    timerEnd: string;
    timeLeft: number;
  } | null;
  currentParticipant: {
    id: string;
    name: string;
    picture?: string;
  } | null;
  housesWithBids: {
    id: string;
    name: string;
  }[];
  winningHouse: {
    id: string;
    name: string;
    amount: number;
  } | null;
}

export interface RoundResult {
  winningBid: {
    houseID: ObjectId;
    houseName: string;
    amount: number;
    timestamp: Date;
  } | null;
  allBids: {
    houseID: ObjectId;
    amount: number;
    timestamp: Date;
  }[];
  message: string;
}
