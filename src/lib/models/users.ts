import clientPromise from "@/lib/mongodb";
import { ObjectId, InsertOneResult, UpdateResult, DeleteResult } from "mongodb";

// Interface representing a User document in MongoDB
export interface User {
  _id?: ObjectId;
  username: string;
  password: string; // Hashed password
  role: "admin" | "house_captain";
  houseId?: ObjectId; // Only for house captains
  createdAt: Date;
  lastLogin?: Date;
}

// Name of MongoDB collection
const collectionName = "users";

// Users object containing CRUD operations
export const Users = {
  // Find user by username
  async findByUsername(username: string): Promise<User | null> {
    const client = await clientPromise;
    return client.db().collection<User>(collectionName).findOne({ username });
  },

  // Create a new user
  async create(user: Omit<User, '_id' | 'createdAt'>): Promise<InsertOneResult<User>> {
    const client = await clientPromise;
    const newUser = {
      ...user,
      createdAt: new Date()
    };
    return client.db().collection<User>(collectionName).insertOne(newUser as User);
  },

  // Update user's last login
  async updateLastLogin(id: string): Promise<UpdateResult<User>> {
    const client = await clientPromise;
    return client.db().collection<User>(collectionName).updateOne(
      { _id: new ObjectId(id) },
      { $set: { lastLogin: new Date() } }
    );
  },

  // Get user by ID
  async getById(id: string): Promise<User | null> {
    const client = await clientPromise;
    return client.db().collection<User>(collectionName).findOne({ _id: new ObjectId(id) });
  },

  // Get all users
  async getAll(): Promise<User[]> {
    const client = await clientPromise;
    return client.db().collection<User>(collectionName).find({}).toArray();
  }
};