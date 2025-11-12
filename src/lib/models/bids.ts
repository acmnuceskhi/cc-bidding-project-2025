import clientPromise from "@/lib/mongodb";
import { ObjectId, InsertOneResult, UpdateResult, Document } from "mongodb";

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

// Ensure indexes (run once on startup) - non-unique to allow full bid history per house per round
async function ensureIndexes() {
  try {
    const client = await clientPromise;
    const col = client.db().collection<Bid>(collectionName);
    // Drop legacy unique index if it exists to allow multiple bids per (roundId, houseId)
    try {
      await col.dropIndex("roundId_1_houseId_1");
    } catch {
      // ignore if not found
    }
    await col.createIndex({ roundId: 1 });
    await col.createIndex({ houseId: 1 });
    await col.createIndex({ participantId: 1 });
    // Compound index to efficiently fetch latest bid per house in a round
    await col.createIndex({ roundId: 1, houseId: 1, timestamp: -1 });
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
    if (typeof bid.participantId === "string") {
      bid.participantId = new ObjectId(bid.participantId);
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

  /**
   * Retrieves the single latest bid for each house within a specific round.
   * This is the definitive method to get final bids for round-end calculations.
   * @param roundId - The ID of the round.
   * @returns A promise that resolves to an array of the latest bids, one per house.
   */
  async getLatestBidPerHouseForRound(roundId: string): Promise<Bid[]> {
    const client = await clientPromise;
    const col = client.db().collection<Bid>(collectionName);

    // Aggregation pipeline to get the latest bid from each house for the specified round
    const pipeline = [
      // Match bids for the specific round
      { $match: { roundId: new ObjectId(roundId) } },
      // Sort by timestamp descending to get the latest bids first
      { $sort: { timestamp: -1 } },
      // Group by houseId and take the first document (which is the latest bid)
      {
        $group: {
          _id: "$houseId",
          latestBid: { $first: "$$ROOT" },
        },
      },
      // Replace the root with the latest bid document
      { $replaceRoot: { newRoot: "$latestBid" } },
    ];

    const bids = await col.aggregate<Bid>(pipeline).toArray();
    return bids;
  },

  /**
   * Upserts a bid for a given house and round.
   * If a bid already exists, it updates the bid amount and timestamp.
   * If no bid exists, it creates a new bid entry.
   * @param roundId - The ID of the round.
   * @param houseId - The ID of the house.
   * @param participantId - The ID of the participant.
   * @param amount - The bid amount.
   * @returns A promise that resolves to the upserted bid document.
   */
  async upsertBid(
    roundId: string,
    houseId: string,
    participantId: string,
    amount: number
  ): Promise<Bid> {
    const client = await clientPromise;
    const bidData: Partial<Bid> = {
      roundId: new ObjectId(roundId),
      houseId: new ObjectId(houseId),
      participantId: new ObjectId(participantId),
      amount,
      timestamp: new Date(),
    };

    // Update or insert the bid
    const result = await client
      .db()
      .collection<Bid>(collectionName)
      .findOneAndUpdate(
        { roundId: bidData.roundId, houseId: bidData.houseId },
        { $set: bidData },
        { upsert: true, returnDocument: "after" }
      );

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
