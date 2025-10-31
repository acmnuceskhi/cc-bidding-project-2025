import clientPromise  from "@/lib/mongodb";
import { ObjectId, InsertOneResult, UpdateResult, DeleteResult } from "mongodb";

// Interface representing a team document in MongoDB
export interface Team {
    _id?: ObjectId;         // MongoDB document ID
    houseId: ObjectId;      // ID of the house this team belongs to
    members: ObjectId[];    // Array of participant IDs assigned to this team
}

// Name of the MongoDB collection
const collectionName = "teams";

// Teams object containing CRUD operations
export const Teams = {
    /**
     * Create a new team
     * @param team - Team object
     */
    async create(team: Team): Promise<InsertOneResult<Team>> {
        const client = await clientPromise;

        // Normalise foreign keys
        if (typeof team.houseId === "string") {
            team.houseId = new ObjectId(team.houseId);
        }

        team.members = team.members.map(m =>
            typeof m === "string" ? new ObjectId(m) : m
        );

        return client.db().collection<Team>(collectionName).insertOne(team);
    },

    /**
     * Fetch all teams belonging to a specific house
     * @param houseId - ID of the house
     */
    async getByHouse(houseId: string): Promise<Team[]> {
        const client = await clientPromise;
        return client.db().collection<Team>(collectionName).find({ houseId: new ObjectId(houseId) }).toArray();
    },

    /**
     * Fetch a single team by ID
     * @param id - MongoDB ObjectId as string
     */
    async getByID(id: string): Promise<Team | null> {
        const client = await clientPromise;
        return client.db().collection<Team>(collectionName).findOne({ _id: new ObjectId(id) });
    },

    /**
     * Fetch all teams
     * Useful for admin dashboards
     */
    async getAll(): Promise<Team[]> {
        const client = await clientPromise;
        return client.db().collection<Team>(collectionName).find({}).sort({ _id: 1}).toArray();
    },

    /**
     * Update a team by ID
     * @param id - MongoDB ObjectId as string
     * @param update - Partial team object with fields to update
     * @returns 
     */
    async update(id: string, update: Partial<Team>): Promise<UpdateResult> {
        const client = await clientPromise;

        // Normalise FK if passed
        if (update.houseId && typeof update.houseId === "string") {
            update.houseId = new ObjectId(update.houseId);
        }

        if (update.members) {
            update.members = update.members.map(m =>
                typeof m === "string" ? new ObjectId(m) : m
            );
        }

        return client.db().collection<Team>(collectionName).updateOne({ _id: new ObjectId(id) }, { $set: update });
    },

    /**
     * Delete a team by ID
     * @param id - MongoDB ObjectId as string
     */
    async delete(id: string): Promise<DeleteResult> {
        const client = await clientPromise;
        return client.db().collection<Team>(collectionName).deleteOne({ _id: new ObjectId(id) });
    },
};
