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
  // Legacy default when no per-batch limits are configured
  maxTeamsPerBatch: number; // Maximum number of teams from a single batch that a house can win (fallback)
  // Per-batch explicit limits (e.g. { "2022": 1, "2023": 2 })
  batchLimits?: Record<string, number>;
  // Per-bid hard cap; if null/undefined => unlimited
  maxBidAmount?: number | null;
  // Per-bid minimum cap; if null/undefined => 1
  minBidAmount?: number | null;

  // Round timing settings
  roundDurationSeconds: number; // Duration of each bidding round in seconds
  countdownWarningSeconds: number; // Seconds before end to show warning (e.g., red timer)

  // Auto-advance settings
  autoStartNextRound: boolean; // Automatically start next round after current completes
  delayBetweenRoundsSeconds: number; // Delay before auto-starting next round (if enabled)

  // Authoritative auction state fields (single-source-of-truth)
  // These five fields are used by clients to determine current status
  currentRound?: string; // ID or label of the current round (string identifier)
  auctionStartTime?: Date | null; // Auction window start
  auctionEndTime?: Date | null; // Auction window end
  currentRoundStartTime?: Date | null; // Current round start time
  currentRoundEndTime?: Date | null; // Current round end time
}

const collectionName = "config";
const CONFIG_ID = "auction-config";

// Default configuration values
const DEFAULT_CONFIG: AuctionConfig = {
  _id: CONFIG_ID,

  // Team and batch constraints
  maxTeamsPerBatch: 1, // Fallback default
  batchLimits: {
    "2022": 1,
    "2023": 3,
    "2024": 3,
    "2025": 4,
  },
  maxBidAmount: null,
  minBidAmount: 1,

  // Round timing settings
  roundDurationSeconds: 120, // 2 minutes per round
  countdownWarningSeconds: 30, // Show warning in last 30 seconds

  // Auto-advance settings
  autoStartNextRound: false, // Manual control by default
  delayBetweenRoundsSeconds: 5, // 5 second delay if auto-start enabled

  // Default authoritative fields
  currentRound: "",
  auctionStartTime: null,
  auctionEndTime: null,
  currentRoundStartTime: null,
  currentRoundEndTime: null,
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

    // Normalize the five authoritative time fields into JS Date|null
    const normalizeDate = (v: unknown): Date | null | undefined => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      if (v instanceof Date) return v;
      if (typeof v === "number") return new Date(v);
      if (typeof v === "string") {
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
      }
      if (
        v &&
        typeof v === "object" &&
        typeof (v as any).toDate === "function"
      ) {
        try {
          const d = (v as any).toDate();
          return d instanceof Date ? d : null;
        } catch {
          return null;
        }
      }
      return null;
    };

    const normalized: AuctionConfig = {
      ...(config as AuctionConfig),
      auctionStartTime: normalizeDate((config as any).auctionStartTime) ?? null,
      auctionEndTime: normalizeDate((config as any).auctionEndTime) ?? null,
      currentRoundStartTime:
        normalizeDate((config as any).currentRoundStartTime) ?? null,
      currentRoundEndTime:
        normalizeDate((config as any).currentRoundEndTime) ?? null,
    };

    return normalized;
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

    // Normalize possible string inputs for the five time fields into Dates/null
    const normalizeDate = (v: unknown): Date | null | undefined => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      if (v instanceof Date) return v;
      if (typeof v === "number") return new Date(v);
      if (typeof v === "string") {
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
      }
      return null;
    };

    const normalized: Partial<AuctionConfig> = { ...updateFields };
    if (
      Object.prototype.hasOwnProperty.call(updateFields, "auctionStartTime")
    ) {
      (normalized as any).auctionStartTime = normalizeDate(
        (updateFields as any).auctionStartTime
      );
    }
    if (Object.prototype.hasOwnProperty.call(updateFields, "auctionEndTime")) {
      (normalized as any).auctionEndTime = normalizeDate(
        (updateFields as any).auctionEndTime
      );
    }
    if (
      Object.prototype.hasOwnProperty.call(
        updateFields,
        "currentRoundStartTime"
      )
    ) {
      (normalized as any).currentRoundStartTime = normalizeDate(
        (updateFields as any).currentRoundStartTime
      );
    }
    if (
      Object.prototype.hasOwnProperty.call(updateFields, "currentRoundEndTime")
    ) {
      (normalized as any).currentRoundEndTime = normalizeDate(
        (updateFields as any).currentRoundEndTime
      );
    }

    // Remove undefined keys so we don't overwrite existing fields unintentionally
    for (const key of Object.keys(normalized)) {
      if ((normalized as any)[key] === undefined) {
        delete (normalized as any)[key];
      }
    }

    return collection.updateOne(
      { _id: CONFIG_ID },
      { $set: normalized },
      { upsert: true }
    );
  },

  /**
   * Get the maximum teams per batch limit.
   * Convenience method for the most commonly accessed setting.
   */
  async getMaxTeamsPerBatch(batch?: string): Promise<number> {
    const config = await this.get();
    // If a specific batch is requested, prefer explicit batchLimits
    if (batch && config.batchLimits && typeof config.batchLimits[batch] === "number") {
      return config.batchLimits[batch];
    }
    // Fallback to legacy scalar
    return config.maxTeamsPerBatch;
  },

  /**
   * Get only the five authoritative auction state fields.
   */
  async getAuctionState(): Promise<
    Pick<
      AuctionConfig,
      | "currentRound"
      | "auctionStartTime"
      | "auctionEndTime"
      | "currentRoundStartTime"
      | "currentRoundEndTime"
    >
  > {
    const {
      currentRound,
      auctionStartTime,
      auctionEndTime,
      currentRoundStartTime,
      currentRoundEndTime,
    } = await this.get();
    return {
      currentRound,
      auctionStartTime,
      auctionEndTime,
      currentRoundStartTime,
      currentRoundEndTime,
    };
  },
};
