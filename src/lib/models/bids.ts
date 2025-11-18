import clientPromise from "@/lib/mongodb";
import { ObjectId, InsertOneResult, UpdateResult, Document } from "mongodb";

// Interface representing a Bid document in MongoDB
export interface Bid {
  _id?: ObjectId; // MongoDB document ID
  roundId: ObjectId; // ID of the round this bid belongs to
  houseId: ObjectId; // ID of the house placing the bid
  teamId: ObjectId; // ID of the team being bid on (replaces participantId)
  amount: number; // Bid amount
  timestamp: Date; // Time when bid was placed
}

// Name of MongoDB collection
const collectionName = "bids";

// Ensure indexes (run once on startup) - unique per (roundId, houseId) to keep only latest bid
async function ensureIndexes() {
  try {
    const client = await clientPromise;
    const col = client.db().collection<Bid>(collectionName);
    // Unique compound index so only one document exists per house per round
    await col.createIndex({ roundId: 1, houseId: 1 }, { unique: true });
    // Supporting indexes for queries
    await col.createIndex({ roundId: 1 });
    await col.createIndex({ houseId: 1 });
    await col.createIndex({ teamId: 1 }); // Changed from participantId

    // Compound index for amount+timestamp queries (for finding winning bids)
    await col.createIndex({ roundId: 1, amount: -1, timestamp: 1 });
    // PERF FIX: Optimized index for house-specific bid queries with sorting
    await col.createIndex({ houseId: 1, roundId: 1, amount: -1, timestamp: 1 });
    // Defensive TTL index for lightweight locks used by admin operations
    // Stale lock documents will be automatically removed after 5 minutes.
    try {
      await client
        .db()
        .collection("_locks")
        .createIndex({ createdAt: 1 }, { expireAfterSeconds: 300 });
    } catch (err) {
      // If creating the TTL index fails (e.g., permissions), log but continue.
      console.warn("Failed to create TTL index on _locks.createdAt:", err);
    }
  } catch (err) {
    console.error("Failed to create indexes on bids:", err);
  }
}
ensureIndexes();

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
    if (typeof bid.teamId === "string") {
      bid.teamId = new ObjectId(bid.teamId);
    }

    // Store valid Date objects
    bid.timestamp = new Date(bid.timestamp);

    return client.db().collection<Bid>(collectionName).insertOne(bid);
  },

  async getById(id: string): Promise<Bid | null> {
    const client = await clientPromise;
    return client
      .db()
      .collection<Bid>(collectionName)
      .findOne({ _id: new ObjectId(id) });
  },

  /**
   * Fetch all bids for a specific team
   * @param teamId - ObjectId as string
   */
  async getByTeam(teamId: string): Promise<Bid[]> {
    const client = await clientPromise;
    return client
      .db()
      .collection<Bid>(collectionName)
      .find({ teamId: new ObjectId(teamId) })
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

  /**
   * Retrieves the single latest bid for each house within a specific round.
   * This is the definitive method to get final bids for round-end calculations.
   * @param roundId - The ID of the round.
   * @returns A promise that resolves to an array of the latest bids, one per house.
   */
  async getLatestBidPerHouseForRound(roundId: string): Promise<Bid[]> {
    // With unique (roundId, houseId) each document already represents the latest bid
    const client = await clientPromise;
    return client
      .db()
      .collection<Bid>(collectionName)
      .find({ roundId: new ObjectId(roundId) })
      .toArray();
  },

  /**
   * Upserts a bid for a given house and round.
   * If a bid already exists, it updates the bid amount and timestamp.
   * If no bid exists, it creates a new bid entry.
   * @param roundId - The ID of the round.
   * @param houseId - The ID of the house.
   * @param teamId - The ID of the team.
   * @param amount - The bid amount.
   * @returns A promise that resolves to the upserted bid document.
   */
  async upsertBid(
    roundId: string,
    houseId: string,
    teamId: string,
    amount: number
  ): Promise<Bid> {
    const client = await clientPromise;
    const col = client.db().collection<Bid>(collectionName);
    const filter = {
      roundId: new ObjectId(roundId),
      houseId: new ObjectId(houseId),
    };
    const update = {
      $set: {
        roundId: new ObjectId(roundId),
        houseId: new ObjectId(houseId),
        teamId: new ObjectId(teamId),
        amount,
        timestamp: new Date(),
      },
    };
    const result = await col.findOneAndUpdate(filter, update, {
      upsert: true,
      returnDocument: "after",
    });
    return result as Bid;
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

  async updateWithOperator(
    id: string,
    update: Document
  ): Promise<UpdateResult<Bid>> {
    const client = await clientPromise;
    return client
      .db()
      .collection<Bid>(collectionName)
      .updateOne({ _id: new ObjectId(id) }, update);
  },

  async delete(id: string) {
    const client = await clientPromise;
    return client
      .db()
      .collection<Bid>(collectionName)
      .deleteOne({ _id: new ObjectId(id) });
  },
};
