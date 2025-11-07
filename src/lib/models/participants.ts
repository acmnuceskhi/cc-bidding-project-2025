import clientPromise from "@/lib/mongodb";
import { ObjectId, InsertOneResult, UpdateResult, Db } from "mongodb";

// Interface representing a Participant document in MongoDB
export interface Participant {
  _id?: ObjectId; // MongoDB document ID
  name: string; // Participant's name
  picture?: string; // URL to participant's picture

  houseId?: ObjectId; // ID of the house assigned (ObjectId reference)

  teamId: ObjectId; // ID of the Round 1 team assigned (ObjectId reference)

  roundStats?: {
    roundId: ObjectId; // Round ID (ObjectId reference)
    bidAmount: number; // Amount bid in this round
    winner: boolean;
  }[]; // Whether participant won this round
}

// Name of MongoDB collection
const collectionName = "participants";

// Participant object containing CRUD operations
export const Participants = {
  // Fetch all participants from the database
  async getAll(): Promise<Participant[]> {
    const client = await clientPromise;
    return client
      .db()
      .collection<Participant>(collectionName)
      .find({})
      .sort({ name: 1 })
      .toArray();
  },

  // Create a new participant
  async create(
    participant: Participant
  ): Promise<InsertOneResult<Participant>> {
    const client = await clientPromise;
    const db = client.db();

    if (!participant.teamId) {
      throw new Error("teamId (round 1) is required to create a participant");
    }

    // Convert string into ObjectId
    if (typeof participant.teamId === "string") {
      participant.teamId = new ObjectId(participant.teamId);
    }

    const exists = await db
      .collection("teams")
      .countDocuments({ _id: participant.teamId });

    if (exists === 0) {
      throw new Error("Invalid teamId: No such team exists");
    }

    return db
      .collection<Participant>(collectionName)
      .insertOne({ ...participant });
  },

  /**
   * Update a participant by ID
   * @param id - MongoDB ObjectId as string
   * @param update - Partial participant object with fields to update
   */
  async update(
    id: string,
    update: Partial<Participant>
  ): Promise<UpdateResult<Participant>> {
    const client = await clientPromise;
    const db = client.db();

    // Convert string references to ObjectId when passed inside update
    if (update.houseId && typeof update.houseId === "string") {
      update.houseId = new ObjectId(update.houseId);
    }

    if (update.teamId && typeof update.teamId === "string") {
      update.teamId = new ObjectId(update.teamId);
    }

    // Validate updated team reference
    if (update.teamId) {
      const exists = await db
        .collection("teams")
        .countDocuments({ _id: update.teamId });

      if (exists === 0) {
        throw new Error("Invalid teamId: No such team exists");
      }
    }

    // RoundId conversion
    if (update.roundStats) {
      update.roundStats = update.roundStats.map((stat) => ({
        ...stat,
        roundId:
          typeof stat.roundId === "string"
            ? new ObjectId(stat.roundId)
            : stat.roundId,
      }));
    }

    return db
      .collection<Participant>(collectionName)
      .updateOne({ _id: new ObjectId(id) }, { $set: update });
  },

  /**
   * Fetch a single participant by ID
   * @param id - MongoDB ObjectId as string
   */
  async getById(id: string): Promise<Participant | null> {
    const client = await clientPromise;
    return client
      .db()
      .collection<Participant>(collectionName)
      .findOne({ _id: new ObjectId(id) });
  },
};
