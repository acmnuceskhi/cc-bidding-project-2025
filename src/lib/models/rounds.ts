import clientPromise from "@/lib/mongodb";
import { ObjectId, InsertOneResult, UpdateResult, DeleteResult } from "mongodb";

// Interface representing a Round document in MongoDB
export interface Round {
  _id?: ObjectId; // MongoDB document ID
  teamId: ObjectId; // ID of the team up for bidding (replaces participantId)
  status: "scheduled" | "active" | "completed"; // Round status flag
  passPhase?: 1 | 2; // Auction pass phase
  timerEnd?: Date | null; // Timestamp when round ends, optional to allow manual admin control
  scheduledStart?: Date | null; // Round scheduled start time
  finalized?: boolean; // To indicate team sold or up for next pass
  winningBid?: number; // Final winning bid amount, if any
  skipped?: boolean; // Indicates round completed with no bids (eligible for second pass)
  // bids: Bid[]; Removed since redundant; bids.ts already present
}

// Name of MongoDB collection
const collectionName = "rounds";

// Ensure indexes on startup
async function ensureIndexes() {
  try {
    const client = await clientPromise;
    const collection = client.db().collection<Round>(collectionName);

    // Index on teamId for frequent lookups (replaces participantId)
    await collection.createIndex({ teamId: 1 });

    // Index on status for filtering active rounds
    await collection.createIndex({ status: 1 });

    // Compound index for status and timerEnd queries
    await collection.createIndex({ status: 1, timerEnd: 1 });

    // Index on passPhase for phase analytics
    await collection.createIndex({ passPhase: 1 });

    // Compound index for status + passPhase queries (used in status endpoint)
    await collection.createIndex({ status: 1, passPhase: 1 });

    // Compound index for filtering completed/skipped rounds
    await collection.createIndex({ status: 1, finalized: 1 });
    await collection.createIndex({ status: 1, skipped: 1 });

    console.log("Rounds indexes created successfully");
  } catch (err) {
    console.error("Failed to create indexes on rounds:", err);
  }
}
ensureIndexes();

// Rounds object containing CRUD operations
export const Rounds = {
  /**
   * Create a new round
   * @param round  - Round object
   */
  async create(round: Round): Promise<InsertOneResult<Round>> {
    const client = await clientPromise;

    // Convert teamId if coming as string
    if (typeof round.teamId === "string") {
      round.teamId = new ObjectId(round.teamId);
    }

    // Default passPhase to 1 when not provided
    if (!round.passPhase) {
      round.passPhase = 1;
    }

    // Ensure timerEnd and scheduledStart are real Date object
    if (round.timerEnd) {
      round.timerEnd = new Date(round.timerEnd);
    }
    if (round.scheduledStart) {
      round.scheduledStart = new Date(round.scheduledStart);
    }

    return client.db().collection<Round>(collectionName).insertOne(round);
  },

  /**
   * Update an existing round by ID
   * @param id - MongoDB ObjectId as string
   * @param update - Partial round object with fields to update
   */
  async update(
    id: string,
    update: Partial<Round>
  ): Promise<UpdateResult<Round>> {
    const client = await clientPromise;

    // Convert teamId if passed
    if (update.teamId && typeof update.teamId === "string") {
      update.teamId = new ObjectId(update.teamId);
    }

    // If updating time, ensure Date type
    if (update.timerEnd) {
      update.timerEnd = new Date(update.timerEnd);
    }
    if (update.scheduledStart) {
      update.scheduledStart = new Date(update.scheduledStart);
    }

    return client
      .db()
      .collection<Round>(collectionName)
      .updateOne({ _id: new ObjectId(id) }, { $set: update });
  },

  /**
   * Fetch a single round by ID
   * @param id - MongoDB ObjectId as string
   */
  async getById(id: string): Promise<Round | null> {
    const client = await clientPromise;
    return client
      .db()
      .collection<Round>(collectionName)
      .findOne({ _id: new ObjectId(id) });
  },

  // Fetch all rounds (newest first)
  async getAll(): Promise<Round[]> {
    const client = await clientPromise;
    return client
      .db()
      .collection<Round>(collectionName)
      .find({})
      .sort({ timerEnd: -1 })
      .toArray();
  },

  /**
   * Fetch only active records
   * Useful for real-time dashboards
   */
  async getActive(): Promise<Round[]> {
    const client = await clientPromise;
    return client
      .db()
      .collection<Round>(collectionName)
      .find({ status: "active" })
      .sort({ timerEnd: -1 })
      .toArray();
  },

  // Fetch all rounds for a specific team
  async getByTeam(teamId: string): Promise<Round[]> {
    const client = await clientPromise;
    return client
      .db()
      .collection<Round>(collectionName)
      .find({ teamId: new ObjectId(teamId) })
      .sort({ timerEnd: -1 })
      .toArray();
  },

  // Depreciated since round.bids not stored here
  // Fetch all rounds for a specific house
  // async getByHouse(houseId: string): Promise<Round[]> {
  //     const client = await clientPromise;
  //     return client
  //       .db()
  //       .collection<Round>(collectionName)
  //       .find({ "bids.houseId": new ObjectId(houseId) })
  //       .sort({ timerEnd: -1 })
  //       .toArray();
  // },

  // Delete a round by ID
  async delete(id: string): Promise<DeleteResult> {
    const client = await clientPromise;
    return client
      .db()
      .collection<Round>(collectionName)
      .deleteOne({ _id: new ObjectId(id) });
  },
};
