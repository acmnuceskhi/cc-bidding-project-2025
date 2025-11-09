import clientPromise from "@/lib/mongodb";
import { ObjectId, InsertOneResult, UpdateResult } from "mongodb";

// Interface representing a User document in MongoDB
export interface User {
  _id?: ObjectId;
  username: string;
  password: string; // Hashed password
  role: "admin" | "house_captain";
  houseId?: ObjectId; // Only for house captains
  createdAt: Date;
  lastLogin?: Date;
  activeSessionToken?: string | null;
  lastActiveAt?: Date | null;
}

// Name of MongoDB collection
const collectionName = "users";

// Ensure indexes on startup
async function ensureIndexes() {
  try {
    const client = await clientPromise;
    const collection = client.db().collection<User>(collectionName);
    
    // Unique index on username for login queries
    await collection.createIndex({ username: 1 }, { unique: true });
    
    // Index on activeSessionToken for session validation (sparse since optional)
    await collection.createIndex({ activeSessionToken: 1 }, { sparse: true });
    
    // Index on role for role-based queries
    await collection.createIndex({ role: 1 });
    
    // Index on houseId for house captain lookups (sparse since optional)
    await collection.createIndex({ houseId: 1 }, { sparse: true });
    
    console.log("Users indexes created successfully");
  } catch (err) {
    console.error("Failed to create indexes on users:", err);
  }
}
ensureIndexes();

// Users object containing CRUD operations
export const Users = {
  // Find user by username
  async findByUsername(username: string): Promise<User | null> {
    const client = await clientPromise;
    return client.db().collection<User>(collectionName).findOne({ username });
  },

  // Create a new user
  async create(
    user: Omit<User, "_id" | "createdAt">
  ): Promise<InsertOneResult<User>> {
    const client = await clientPromise;

    if (user.houseId && typeof user.houseId === "string") {
      user.houseId = new ObjectId(user.houseId);
    }

    const newUser = {
      ...user,
      createdAt: new Date(),
    };
    return client
      .db()
      .collection<User>(collectionName)
      .insertOne(newUser as User);
  },

  // Update user's last login
  async updateLastLogin(id: string): Promise<UpdateResult<User>> {
    const client = await clientPromise;
    return client
      .db()
      .collection<User>(collectionName)
      .updateOne(
        { _id: new ObjectId(id) },
        { $set: { lastLogin: new Date() } }
      );
  },

  // Generic update
  async update(
    id: string,
    updateData: Partial<User>
  ): Promise<UpdateResult<User>> {
    const client = await clientPromise;

    if (updateData.houseId && typeof updateData.houseId === "string") {
      updateData.houseId = new ObjectId(updateData.houseId);
    }

    return client
      .db()
      .collection<User>(collectionName)
      .updateOne({ _id: new ObjectId(id) }, { $set: updateData });
  },

  // Get user by ID
  async getById(id: string): Promise<User | null> {
    const client = await clientPromise;
    return client
      .db()
      .collection<User>(collectionName)
      .findOne({ _id: new ObjectId(id) });
  },

  // Get user(s) by role
  async getByRole(role: User["role"]): Promise<User[]> {
    const client = await clientPromise;
    return client
      .db()
      .collection<User>(collectionName)
      .find({ role })
      .toArray();
  },

  // Get all users
  async getAll(): Promise<User[]> {
    const client = await clientPromise;
    return client.db().collection<User>(collectionName).find({}).toArray();
  },
};
