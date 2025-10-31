import clientPromise from "@/lib/mongodb";
import { ObjectId, InsertOneResult } from "mongodb";

// Interface representing a Bid document in MongoDB
export interface Bid {
    _id?: ObjectId;         // MongoDB document ID
    houseID: ObjectId;        // ID of the house placing the bid
    participantID: ObjectId;  // ID of the participant being bid on
    amount: number;         // Bid amount
    timestamp: Date;        // Time when bid was placed
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

        // Store valid Date objects
        bid.timestamp = new Date(bid.timestamp);

        return client.db().collection<Bid>(collectionName).insertOne(bid);
    },

    /**
     * Fetch all bids for a specific participant
     * @param participantID - ObjectId as string
     */
    async getByParticipant(participantID: string): Promise<Bid[]> {
        const client = await clientPromise;
        return client.db().collection<Bid>(collectionName).find({ participantID: new ObjectId(participantID) }).sort({ timestamp: -1 }).toArray();
    },

    /**
     * Fetch all bids for a specific house
     * @param houseID - ObjectId as string
     * @returns 
     */
    async getByHouse(houseID: string): Promise<Bid[]> {
        const client = await clientPromise;
        return client.db().collection<Bid>(collectionName).find({ houseID: new ObjectId(houseID) }).sort({ timestamp: -1 }).toArray();
    },

    // Fetch all bids from the database
    async getAll(): Promise<Bid[]> {
        const client = await clientPromise;
        return client.db().collection<Bid>(collectionName).find({}).sort({ timestamp: -1 }).toArray();
    },
};
