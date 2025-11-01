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
    
    /**
     * Get the winning bid for a participant based on highest amount and earliest timestamp
     * @param participantID - Participant ID as string
     */
    async getWinningBid(participantID: string): Promise<Bid | null> {
        const client = await clientPromise;
        
        // Get all bids for this participant
        const bids = await client.db().collection<Bid>(collectionName)
            .find({ participantID: new ObjectId(participantID) })
            .sort({ amount: -1, timestamp: 1 })
            .toArray();
            
        if (bids.length === 0) {
            return null;
        }
        
        // Return the first bid (highest amount, earliest timestamp)
        return bids[0];
    }
};