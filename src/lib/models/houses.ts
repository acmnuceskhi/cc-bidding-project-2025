import clientPromise from "@/lib/mongodb";
import {
  ObjectId,
  InsertOneResult,
  UpdateResult,
  DeleteResult,
  Document,
} from "mongodb";

// Interface representing a House document in MongoDB
export interface House {
  _id?: ObjectId; // MongoDB document ID
  name: string; // Name of the house
  totalBudget: number; // Total budget allocated to the house
  remainingBudget: number; // Remaining points for bidding
}

// Name of the MongoDB collection
const collectionName = "houses";

// Ensure indexes on startup
async function ensureIndexes() {
  try {
    const client = await clientPromise;
    const collection = client.db().collection<House>(collectionName);

    // Index on name for lookups and sorting
    await collection.createIndex({ name: 1 });

    console.log("Houses indexes created successfully");
  } catch (err) {
    console.error("Failed to create indexes on houses:", err);
  }
}
ensureIndexes();

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
  async update(
    id: string,
    update: Partial<House>
  ): Promise<UpdateResult<House>> {
    const client = await clientPromise;
    return client
      .db()
      .collection<House>(collectionName)
      .updateOne({ _id: new ObjectId(id) }, { $set: update });
  },

  // Atomic update (not used most likely)
  updateWithOperator: async (
    id: string,
    update: Document
  ): Promise<UpdateResult<House>> => {
    const client = await clientPromise;
    return client
      .db()
      .collection<House>(collectionName)
      .updateOne({ _id: new ObjectId(id) }, update);
  },

  /**
   * Atomically reserve budget for a bid
   * Returns the updated house if successful, null if insufficient budget
   * @param id - MongoDB ObjectId as string
   * @param amount - Amount to reserve from remaining budget
   */
  async reserveBudget(id: string, amount: number): Promise<House | null> {
    const client = await clientPromise;
    // In current MongoDB driver typings, findOneAndUpdate returns the updated doc (or null)
    const updatedDoc = await client
      .db()
      .collection<House>(collectionName)
      .findOneAndUpdate(
        {
          _id: new ObjectId(id),
          remainingBudget: { $gte: amount }, // ensure budget is sufficient
        },
        {
          $inc: { remainingBudget: -amount },
        },
        {
          returnDocument: "after",
        }
      );

    return updatedDoc ?? null;
  },

  /**
   * Atomically restore budget (e.g., when bid is cancelled or round restarted)
   * @param id - MongoDB ObjectId as string
   * @param amount - Amount to restore to remaining budget
   */
  async restoreBudget(
    id: string,
    amount: number
  ): Promise<UpdateResult<House>> {
    const client = await clientPromise;

    return client
      .db()
      .collection<House>(collectionName)
      .updateOne(
        { _id: new ObjectId(id) },
        { $inc: { remainingBudget: amount } }
      );
  },

  /**
   * Delete a house by ID
   * @param id - MongoDB ObjectId as string
   */
  async delete(id: string): Promise<DeleteResult> {
    const client = await clientPromise;
    return client
      .db()
      .collection<House>(collectionName)
      .deleteOne({ _id: new ObjectId(id) });
  },

  /**
   * Fetch a single house by ID
   * @param id - MongoDB ObjectId as string
   */
  async getById(id: string): Promise<House | null> {
    const client = await clientPromise;
    return client
      .db()
      .collection<House>(collectionName)
      .findOne({ _id: new ObjectId(id) });
  },
};
