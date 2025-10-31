import clientPromise from "@/lib/mongodb";
import { ObjectId, InsertOneResult, UpdateResult } from "mongodb";

// Interface representing a Participant document in MongoDB
export interface Participant {
    _id?: ObjectId;             // MongoDB document ID
    name: string;               // Participant's name
    picture?: string;           // URL to participant's picture
    assignedHouse?: ObjectId;   // ID of the house assigned (ObjectId reference)
    roundStats?: { 
        roundId: ObjectId;      // Round ID (ObjectId reference) 
        bidAmount: number;      // Amount bid in this round
        winner: boolean }[];    // Whether participant won this round
}

// Name of MongoDB collection
const collectionName = "participants";

// Participant object containing CRUD operations
export const Participants = {
    // Fetch all participants from the database
    async getAll(): Promise<Participant[]> {
        const client = await clientPromise;
        return client.db().collection<Participant>(collectionName).find({}).sort({ name: 1 }).toArray();
    },

    // Create a new participant
    async create(participant: Participant): Promise<InsertOneResult<Participant>> {
        const client = await clientPromise;
        return client.db().collection<Participant>(collectionName).insertOne(participant);
    },

    /**
     * Update a participant by ID
     * @param id - MongoDB ObjectId as string
     * @param update - Partial participant object with fields to update
     */
    async update(id: string, update: Partial<Participant>): Promise<UpdateResult<Participant>> {
        const client = await clientPromise;

        // Convert string references to ObjectId when passed inside update
        if (update.assignedHouse && typeof update.assignedHouse === "string") {
            update.assignedHouse = new ObjectId(update.assignedHouse);
        }

        if (update.roundStats) {
            update.roundStats = update.roundStats.map(stat => ({
                ...stat,
                roundId: typeof stat.roundId === "string" ? new ObjectId(stat.roundId) : stat.roundId,
            }));
        }

        return client.db().collection<Participant>(collectionName).updateOne({ _id: new ObjectId(id) }, { $set: update });
    },

    /**
     * Fetch a single participant by ID
     * @param id - MongoDB ObjectId as string
     */
    async getByID(id: string): Promise<Participant | null> {
        const client = await clientPromise;
        return client.db().collection<Participant>(collectionName).findOne({ _id: new ObjectId(id) });
    },
};
