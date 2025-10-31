import clientPromise from "@/lib/mongodb";
import { ObjectId, InsertOneResult, UpdateResult, DeleteResult } from "mongodb";

// Interface representing a Round document in MongoDB
export interface Round {
    _id?: ObjectId;                                 // MongoDB document ID
    participantID: ObjectId;                        // ID of the participant up for bidding
    bids: { houseID: ObjectId; amount: number }[];  // Array of bids placed by houses
    status: "active" | "completed";                 // Round status flag
    timerEnd: Date;                                 // Timestamp when round ends
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

        // Convert participantID if coming as string
        if (typeof round.participantID === "string") {
            round.participantID = new ObjectId(round.participantID);
        }

        // Convert bids houseIDs if strings
        round.bids = round.bids.map(bid => ({
            ...bid,
            houseID: typeof bid.houseID === "string" ? new ObjectId(bid.houseID) : bid.houseID,
        }));

        // Ensure we store a real Date object
        round.timerEnd = new Date(round.timerEnd);

        return client.db().collection<Round>(collectionName).insertOne(round);
    },

    /**
     * Update an existing round by ID
     * @param id - MongoDB ObjectId as string
     * @param update - Partial round object with fields to update
     */
    async update(id: string, update: Partial<Round>): Promise<UpdateResult<Round>> {
        const client = await clientPromise;

        // Convert participantID if passed
        if (update.participantID && typeof update.participantID === "string") {
            update.participantID = new ObjectId(update.participantID);
        }

        // Convert string -> ObjectId inside bids
        if (update.bids) {
            update.bids = update.bids.map(bid => ({
                ...bid,
                houseID: typeof bid.houseID === "string" ? new ObjectId(bid.houseID) : bid.houseID,
            }));
        }

        // If updating time, ensure Date type
        if (update.timerEnd) {
            update.timerEnd = new Date(update.timerEnd);
        }

        return client.db().collection<Round>(collectionName).updateOne({ _id: new ObjectId(id) }, { $set: update });
    },

    /**
     * Fetch a single round by ID
     * @param id - MongoDB ObjectId as string
     */
    async getByID(id: string): Promise<Round | null> {
        const client = await clientPromise;
        return client.db().collection<Round>(collectionName).findOne({ _id: new ObjectId(id) });
    },

    // Fetch all rounds from the database (newest first)
    async getAll(): Promise<Round[]> {
        const client = await clientPromise;
        return client.db().collection<Round>(collectionName).find({}).sort({ timerEnd: -1 }).toArray();
    },

    /**
     * Fetch only active records
     * Useful for real-time dashboards
     */
    async getActive(): Promise<Round[]> {
        const client = await clientPromise;
        return client.db().collection<Round>(collectionName).find({ status: "active" }).sort({ timerEnd: -1 }).toArray();
    },

    // Delete a round by ID
    async delete(id: string): Promise<DeleteResult> {
        const client = await clientPromise;
        return client.db().collection<Round>(collectionName).deleteOne({ _id: new ObjectId(id) });
    },
};
