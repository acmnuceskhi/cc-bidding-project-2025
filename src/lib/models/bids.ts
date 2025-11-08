import clientPromise from "@/lib/mongodb";
import { ObjectId, InsertOneResult } from "mongodb";

// Interface representing a Bid document in MongoDB
export interface Bid {
  _id?: ObjectId; // MongoDB document ID
  roundId: ObjectId; // ID of the round this bid belongs to
  houseId: ObjectId; // ID of the house placing the bid
  participantId: ObjectId; // ID of the participant being bid on
  amount: number; // Bid amount
  timestamp: Date; // Time when bid was placed
}

// Name of MongoDB collection
const collectionName = "bids";

// Bids object containing CRUD operations
export const Bids = {
  /**
   * Create a new bid
   * @param bid - Bid object
   */
  async create(bid: Bid): Promise<InsertOneResult<Bid>> {
    const client = await clientPromise;

    // Ensure ObjectId fields are properly typed
    if (typeof bid.roundId === "string") {
      bid.roundId = new ObjectId(bid.roundId);
    }
    if (typeof bid.houseId === "string") {
      bid.houseId = new ObjectId(bid.houseId);
    }
    if (typeof bid.participantId === "string") {
      bid.participantId = new ObjectId(bid.participantId);
    }

    // Store valid Date objects
    bid.timestamp = new Date(bid.timestamp);

    return client.db().collection<Bid>(collectionName).insertOne(bid);
  },

  /**
   * Fetch all bids for a specific participant
   * @param participantId - ObjectId as string
   */
  async getByParticipant(participantId: string): Promise<Bid[]> {
    const client = await clientPromise;
    return client
      .db()
      .collection<Bid>(collectionName)
      .find({ participantId: new ObjectId(participantId) })
      .sort({ timestamp: -1 })
      .toArray();
  },

  /**
   * Fetch all bids for a specific house
   * @param houseId - ObjectId as string
   * @returns
   */
  async getByHouse(houseId: string): Promise<Bid[]> {
    const client = await clientPromise;
    return client
      .db()
      .collection<Bid>(collectionName)
      .find({ houseId: new ObjectId(houseId) })
      .sort({ timestamp: -1 })
      .toArray();
  },

  /**
   * Fetch all bids for a specific round
   * @param roundId - ObjectId as string
   */
  async getByRound(roundId: string): Promise<Bid[]> {
    const client = await clientPromise;
    return client
      .db()
      .collection<Bid>(collectionName)
      .find({ roundId: new ObjectId(roundId) })
      .sort({ timestamp: -1 })
      .toArray();
  },

  // Fetch all bids from the database
  async getAll(): Promise<Bid[]> {
    const client = await clientPromise;
    return client
      .db()
      .collection<Bid>(collectionName)
      .find({})
      .sort({ timestamp: -1 })
      .toArray();
  },
};
