// backend/services/cacheService.js
const AWS = require("aws-sdk");
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Get table name from environment variables
const CACHE_TABLE_NAME = process.env.CACHE_TABLE_NAME;
const WEATHER_CACHE_TTL = parseInt(process.env.WEATHER_CACHE_TTL || "3600", 10); // Default 1 hour
const SEGMENT_CACHE_TTL = parseInt(
  process.env.SEGMENT_CACHE_TTL || "604800",
  10
); // Default 1 week

/**
 * Cache item types
 * @enum {string}
 */
const CacheType = {
  WEATHER: "weather",
  SEGMENT: "segment",
};

/**
 * Get cached item by key and type
 * @param {string} key - The cache key
 * @param {CacheType} type - The type of cached item
 * @returns {Promise<Object|null>} - The cached item or null if not found/expired
 */
async function getCachedItem(key, type) {
  const cacheKey = generateCacheKey(key, type);

  try {
    const params = {
      TableName: CACHE_TABLE_NAME,
      Key: { cacheKey },
    };

    const result = await dynamoDB.get(params).promise();

    // Check if item exists and is not expired
    if (result.Item && result.Item.expiry > Math.floor(Date.now() / 1000)) {
      console.log(`Cache hit for ${type}:${key}`);
      return result.Item.data;
    } else if (result.Item) {
      console.log(`Cache expired for ${type}:${key}`);
      // Expired item - delete it asynchronously (don't await)
      deleteCachedItem(key, type).catch((err) =>
        console.error("Error deleting expired cache:", err)
      );
    } else {
      console.log(`Cache miss for ${type}:${key}`);
    }

    return null;
  } catch (error) {
    console.error("Error getting cached item:", error);
    // On error, proceed as if cache missed
    return null;
  }
}

/**
 * Store item in cache
 * @param {string} key - The cache key
 * @param {CacheType} type - The type of cached item
 * @param {Object} data - The data to cache
 * @returns {Promise<boolean>} - Success indicator
 */
async function setCachedItem(key, type, data) {
  const cacheKey = generateCacheKey(key, type);

  // Set TTL based on item type
  const ttl =
    type === CacheType.WEATHER ? WEATHER_CACHE_TTL : SEGMENT_CACHE_TTL;
  const expiry = Math.floor(Date.now() / 1000) + ttl;

  try {
    const params = {
      TableName: CACHE_TABLE_NAME,
      Item: {
        cacheKey,
        type,
        data,
        expiry,
        timestamp: Date.now(),
      },
    };

    await dynamoDB.put(params).promise();
    console.log(`Cached ${type}:${key} (expires in ${ttl} seconds)`);
    return true;
  } catch (error) {
    console.error("Error setting cached item:", error);
    // Cache failures shouldn't fail the request
    return false;
  }
}

/**
 * Delete cached item
 * @param {string} key - The cache key
 * @param {CacheType} type - The type of cached item
 * @returns {Promise<boolean>} - Success indicator
 */
async function deleteCachedItem(key, type) {
  const cacheKey = generateCacheKey(key, type);

  try {
    const params = {
      TableName: CACHE_TABLE_NAME,
      Key: { cacheKey },
    };

    await dynamoDB.delete(params).promise();
    console.log(`Deleted cache for ${type}:${key}`);
    return true;
  } catch (error) {
    console.error("Error deleting cached item:", error);
    return false;
  }
}

/**
 * Generate a consistent cache key
 * @param {string} key - Base key
 * @param {CacheType} type - Cache type
 * @returns {string} - Combined cache key
 */
function generateCacheKey(key, type) {
  return `${type}:${key}`;
}

module.exports = {
  getCachedItem,
  setCachedItem,
  deleteCachedItem,
  CacheType,
};
