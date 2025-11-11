import clientPromise from "@/lib/mongodb";
import { ObjectId, InsertOneResult, UpdateResult } from "mongodb";

/**
 * Represents round 1 team and its shared performance stats
 * Multiple participants reference this via 'teamId' to avoid data duplication
 */
export interface Team {
  _id?: ObjectId;

  // Round 1 stats (awaiting final format)
  rank: number; // team position; 1 = best
  successfulAttempts: number; // Successful problem attempts
  unsuccessfulAttempts: number; // Unsuccessful problem attempts
  totalPoints: number; // Total points earned
  totalPenalty: number; // Total penalty time
  timeTakenPerProblem: number[]; // Time taken per problem (index = problem number)
}

const collectionName = "teams";

export const Teams = {
  // Ensure indexes useful for queries/sorting
  async ensureIndexes() {
    try {
      const client = await clientPromise;
      const collection = client.db().collection<Team>(collectionName);
      await collection.createIndex({ rank: 1 });
    } catch (err) {
      console.error("Failed to create index on teams:", err);
    }
  },
  // Fetch all team documents
  async getAll(): Promise<Team[]> {
    const client = await clientPromise;
    return client.db().collection<Team>(collectionName).find({}).toArray();
  },

  // Create a new team document
  async create(team: Partial<Team>): Promise<InsertOneResult<Team>> {
    const client = await clientPromise;
    return client
      .db()
      .collection<Team>(collectionName)
      .insertOne({
        successfulAttempts: team.successfulAttempts ?? 0,
        unsuccessfulAttempts: team.unsuccessfulAttempts ?? 0,
        totalPoints: team.totalPoints ?? 0,
        totalPenalty: team.totalPenalty ?? 0,
        timeTakenPerProblem: team.timeTakenPerProblem ?? [],
        rank:
          typeof team.rank === "number"
            ? team.rank
            : (() => {
                throw new Error("rank is required when creating a Team");
              })(),
      } as Team);
  },

  // Update any team field
  async update(id: string, update: Partial<Team>): Promise<UpdateResult<Team>> {
    const client = await clientPromise;

    if (
      update.timeTakenPerProblem &&
      !Array.isArray(update.timeTakenPerProblem)
    ) {
      throw new Error("timeTakenPerProblem must be an array of numbers");
    }

    return client
      .db()
      .collection<Team>(collectionName)
      .updateOne({ _id: new ObjectId(id) }, { $set: update });
  },

  // Fetch a single team by ID
  async getById(id: string): Promise<Team | null> {
    const client = await clientPromise;
    return client
      .db()
      .collection<Team>(collectionName)
      .findOne({ _id: new ObjectId(id) });
  },

  /**
   * Deletes a team by ID (most likely not needed)
   * Safe delete: Prevents deletion if any participants reference this team
   * @param id - The ID of the team to delete
   */
  async delete(id: string): Promise<boolean> {
    const client = await clientPromise;
    const db = client.db();

    const objId = new ObjectId(id);

    const participantCount = await db
      .collection("participants")
      .countDocuments({ teamId: objId });

    if (participantCount > 0) {
      throw new Error(
        "Cannot delete team: Participants are still referencing this team."
      );
    }

    const result = await db
      .collection<Team>(collectionName)
      .deleteOne({ _id: objId });
    return result.deletedCount === 1;
  },
};
