import clientPromise from "@/lib/mongodb";
import { ObjectId, InsertOneResult, UpdateResult, DeleteResult } from "mongodb";

// Interface representing a Round document in MongoDB
export interface Round {
  _id?: ObjectId; // MongoDB document ID
  participantId: ObjectId; // ID of the participant up for bidding
  status: "scheduled" | "active" | "completed"; // Round status flag
  timerEnd: Date; // Timestamp when round ends
  scheduledStart?: Date; // Round scheduled start time
  bids: {
    _id?: ObjectId; // MongoDB document ID
    houseId: ObjectId; // ID of house placing the bid
    amount: number; // Bid amount
    timestamp: Date; // When the bid was placed
    edits?: number; // Times the bid has been edited; max 1
  }[];
}

// Name of MongoDB collection
const collectionName = "rounds";

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

    // Convert bids houseIds if strings
    round.bids = round.bids.map((bid) => ({
      ...bid,
      houseId:
        typeof bid.houseId === "string"
          ? new ObjectId(bid.houseId)
          : bid.houseId,
      timestamp: new Date(bid.timestamp),
      edits: bid.edits ?? 0,
    }));

    // Ensure timerEnd and scheduledStart are real Date object
    round.timerEnd = new Date(round.timerEnd);
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

    // Convert string -> ObjectId inside bids
    if (update.bids) {
      update.bids = update.bids.map((bid) => ({
        ...bid,
        houseId:
          typeof bid.houseId === "string"
            ? new ObjectId(bid.houseId)
            : bid.houseId,
        timestamp: bid.timestamp ? new Date(bid.timestamp) : new Date(),
        edits: bid.edits ?? 0,
      }));
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

  // Fetch all rounds for a specific house
  async getByHouse(houseId: string): Promise<Round[]> {
    const client = await clientPromise;
    return client
      .db()
      .collection<Round>(collectionName)
      .find({ "bids.houseId": new ObjectId(houseId) })
      .sort({ timerEnd: -1 })
      .toArray();
  },

  // Delete a round by ID
  async delete(id: string): Promise<DeleteResult> {
    const client = await clientPromise;
    return client
      .db()
      .collection<Round>(collectionName)
      .deleteOne({ _id: new ObjectId(id) });
  },
};
