import clientPromise from "@/lib/mongodb";
import { UpdateResult } from "mongodb";

/**
 * Global configuration settings for the auction system.
 * Stored as a singleton document in the database.
 * All settings can be modified from admin/config during the auction.
 */
export interface AuctionConfig {
  _id?: string; // Fixed ID "auction-config" for singleton pattern

  // Team and batch constraints
  maxTeamsPerBatch: number; // Maximum number of teams from a single batch that a house can win

  // Round timing settings
  roundDurationSeconds: number; // Duration of each bidding round in seconds
  countdownWarningSeconds: number; // Seconds before end to show warning (e.g., red timer)

  // Auto-advance settings
  autoStartNextRound: boolean; // Automatically start next round after current completes
  delayBetweenRoundsSeconds: number; // Delay before auto-starting next round (if enabled)
}

const collectionName = "config";
const CONFIG_ID = "auction-config";

// Default configuration values
const DEFAULT_CONFIG: AuctionConfig = {
  _id: CONFIG_ID,

  // Team and batch constraints
  maxTeamsPerBatch: 1, // Each house can win only 1 team per batch (22k, 23k, 24k, 25k)

  // Round timing settings
  roundDurationSeconds: 120, // 2 minutes per round
  countdownWarningSeconds: 30, // Show warning in last 30 seconds

  // Auto-advance settings
  autoStartNextRound: false, // Manual control by default
  delayBetweenRoundsSeconds: 5, // 5 second delay if auto-start enabled
};

export const Config = {
  /**
   * Get the current auction configuration.
   * Creates default config if it doesn't exist.
   */
  async get(): Promise<AuctionConfig> {
    const client = await clientPromise;
    const collection = client.db().collection<AuctionConfig>(collectionName);

    const config = await collection.findOne({ _id: CONFIG_ID });

    // Initialize with defaults if not found
    if (!config) {
      await collection.insertOne({ ...DEFAULT_CONFIG });
      return DEFAULT_CONFIG;
    }

    return config as AuctionConfig;
  },

  /**
   * Update auction configuration settings.
   * @param update - Partial config object with fields to update
   */
  async update(update: Partial<AuctionConfig>): Promise<UpdateResult> {
    const client = await clientPromise;
    const collection = client.db().collection<AuctionConfig>(collectionName);

    // Remove _id from update to prevent modification
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...updateFields } = update;

    return collection.updateOne(
      { _id: CONFIG_ID },
      { $set: updateFields },
      { upsert: true }
    );
  },

  /**
   * Get the maximum teams per batch limit.
   * Convenience method for the most commonly accessed setting.
   */
  async getMaxTeamsPerBatch(): Promise<number> {
    const config = await this.get();
    return config.maxTeamsPerBatch;
  },
};
