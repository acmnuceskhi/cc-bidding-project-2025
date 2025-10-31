import clientPromise from "@/lib/mongodb";
import { ObjectId, InsertOneResult, UpdateResult, DeleteResult } from "mongodb";

// Interface representing a House document in MongoDB
export interface House {
    _id?: ObjectId;             // MongoDB document ID
    name: string;               // Name of the house
    totalBudget: number;        // Total budget allocated to the house
    remainingBudget: number;    // Remaining points for bidding
    teams: ObjectId[];          // Foreign key references to Team documents
}

// Name of the MongoDB collection
const collectionName = "houses";

// House object containing CRUD operations
export const Houses = {
    // Fetch all houses from the database
    async getAll(): Promise<House[]> {
        const client = await clientPromise;
        return client.db().collection<House>(collectionName).find({}).toArray();
    },

    // Create a new house
    async create(house: House): Promise<InsertOneResult<House>> {
        const client = await clientPromise;
        return client.db().collection<House>(collectionName).insertOne(house);
    },

    /**
     * Update a house by ID
     * @param id - MongoDB ObjectId as string
     * @param update - Partial house object with fields to update
     */
    async update(id: string, update: Partial<House>): Promise<UpdateResult<House>> {
        const client = await clientPromise;
        return client.db().collection<House>(collectionName).updateOne({ _id: new ObjectId(id) }, { $set: update });
    },

    /**
     * Delete a house by ID
     * @param id - MongoDB ObjectId as string
     */
    async delete(id: string): Promise<DeleteResult> {
        const client = await clientPromise;
        return client.db().collection<House>(collectionName).deleteOne({ _id: new ObjectId(id) });
    },

    /**
     * Fetch a single house by ID
     * @param id - MongoDB ObjectId as string
     */
    async getByID(id: string): Promise<House | null> {
        const client = await clientPromise;
        return client.db().collection<House>(collectionName).findOne({ _id: new ObjectId(id) });
    },
};
