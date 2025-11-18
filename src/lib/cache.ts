// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const CACHE_KEY_PREFIX = "cc_bidding_cache_";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Get cached data if it exists and is still valid
 */
export function getCachedData<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const cacheKey = `${CACHE_KEY_PREFIX}${key}`;
    const cached = sessionStorage.getItem(cacheKey);

    if (!cached) {
      console.log(`[Cache] Miss: ${key}`);
      return null;
    }

    const entry: CacheEntry<T> = JSON.parse(cached);
    const isExpired = Date.now() - entry.timestamp > CACHE_DURATION;

    if (isExpired) {
      console.log(`[Cache] Expired: ${key}`);
      sessionStorage.removeItem(cacheKey);
      return null;
    }

    console.log(`[Cache] Hit: ${key}`);
    return entry.data;
  } catch (error) {
    console.error(`[Cache] Error reading cache for ${key}:`, error);
    return null;
  }
}

/**
 * Store data in cache with current timestamp
 */
export function setCachedData<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;

  try {
    const cacheKey = `${CACHE_KEY_PREFIX}${key}`;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(cacheKey, JSON.stringify(entry));
    console.log(`[Cache] Set: ${key}`);
  } catch (error) {
    console.error(`[Cache] Error writing cache for ${key}:`, error);
  }
}

/**
 * Clear specific cache entry
 */
export function clearCache(key: string): void {
  if (typeof window === "undefined") return;

  try {
    const cacheKey = `${CACHE_KEY_PREFIX}${key}`;
    sessionStorage.removeItem(cacheKey);
    console.log(`[Cache] Cleared: ${key}`);
  } catch (error) {
    console.error(`[Cache] Error clearing cache for ${key}:`, error);
  }
}

/**
 * Check if cached data exists and is still valid
 */
export function isCacheValid(key: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    const cacheKey = `${CACHE_KEY_PREFIX}${key}`;
    const cached = sessionStorage.getItem(cacheKey);

    if (!cached) return false;

    const entry: CacheEntry<unknown> = JSON.parse(cached);
    const isExpired = Date.now() - entry.timestamp > CACHE_DURATION;

    return !isExpired;
  } catch (error) {
    console.error(`[Cache] Error checking cache validity for ${key}:`, error);
    return false;
  }
}

/**
 * Get cache age in milliseconds
 */
export function getCacheAge(key: string): number | null {
  if (typeof window === "undefined") return null;

  try {
    const cacheKey = `${CACHE_KEY_PREFIX}${key}`;
    const cached = sessionStorage.getItem(cacheKey);

    if (!cached) return null;

    const entry: CacheEntry<unknown> = JSON.parse(cached);
    return Date.now() - entry.timestamp;
  } catch (error) {
    console.error(`[Cache] Error getting cache age for ${key}:`, error);
    return null;
  }
}
