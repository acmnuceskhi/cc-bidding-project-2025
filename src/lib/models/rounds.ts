import clientPromise from "@/lib/mongodb";
import { ObjectId, InsertOneResult, UpdateResult, DeleteResult } from "mongodb";

// Interface representing a Round document in MongoDB
export interface Round {
  _id?: ObjectId; // MongoDB document ID
  participantId: ObjectId; // ID of the participant up for bidding
  status: "scheduled" | "active" | "completed"; // Round status flag
  timerEnd?: Date | null; // Timestamp when round ends, optional to allow manual admin control
  scheduledStart?: Date | null; // Round scheduled start time
  finalized?: boolean; // To indicate participant sold or up for next pass
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

    // Index on participantId for frequent lookups
    await collection.createIndex({ participantId: 1 });

    // Index on status for filtering active rounds
    await collection.createIndex({ status: 1 });

    // Compound index for status and timerEnd queries
    await collection.createIndex({ status: 1, timerEnd: 1 });

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

    // Convert participantId if coming as string
    if (typeof round.participantId === "string") {
      round.participantId = new ObjectId(round.participantId);
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

    // Convert participantId if passed
    if (update.participantId && typeof update.participantId === "string") {
      update.participantId = new ObjectId(update.participantId);
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

  // Fetch all rounds for a specific participant
  async getByParticipant(participantId: string): Promise<Round[]> {
    const client = await clientPromise;
    return client
      .db()
      .collection<Round>(collectionName)
      .find({ participantId: new ObjectId(participantId) })
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
