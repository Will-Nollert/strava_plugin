// backend/services/cacheService.js - DynamoDB caching service
const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Get environment variables
const SEGMENT_CACHE_TABLE = process.env.SEGMENT_CACHE_TABLE;
const WEATHER_CACHE_TABLE = process.env.WEATHER_CACHE_TABLE;
const SEGMENT_CACHE_TTL = parseInt(process.env.SEGMENT_CACHE_TTL || '604800');  // 7 days default
const WEATHER_CACHE_TTL = parseInt(process.env.WEATHER_CACHE_TTL || '3600');    // 1 hour default

/**
 * Get a segment from the cache
 * @param {string} segmentId - The segment ID
 * @returns {Promise<Object|null>} - The cached segment or null if not found
 */
async function getSegmentFromCache(segmentId) {
    try {
        const params = {
            TableName: SEGMENT_CACHE_TABLE,
            Key: { segmentId }
        };

        const result = await dynamoDB.get(params).promise();

        if (result.Item) {
            console.log(`Cache hit for segment ${segmentId}`);
            return result.Item.data;
        }

        console.log(`Cache miss for segment ${segmentId}`);
        return null;
    } catch (error) {
        console.error('Error getting segment from cache:', error);
        return null; // Return null on error to fallback to API
    }
}

/**
 * Save a segment to the cache
 * @param {string} segmentId - The segment ID
 * @param {Object} data - The segment data to cache
 * @returns {Promise<boolean>} - Whether the operation succeeded
 */
async function saveSegmentToCache(segmentId, data) {
    try {
        const now = Math.floor(Date.now() / 1000);
        const ttl = now + SEGMENT_CACHE_TTL;

        const params = {
            TableName: SEGMENT_CACHE_TABLE,
            Item: {
                segmentId,
                data,
                ttl,
                timestamp: now
            }
        };

        await dynamoDB.put(params).promise();
        console.log(`Saved segment ${segmentId} to cache with TTL ${ttl}`);
        return true;
    } catch (error) {
        console.error('Error saving segment to cache:', error);
        return false;
    }
}

/**
 * Get weather data from the cache
 * @param {string} lat - Latitude
 * @param {string} lon - Longitude
 * @param {string} [dt] - Optional timestamp for historical weather
 * @returns {Promise<Object|null>} - The cached weather data or null if not found
 */
async function getWeatherFromCache(lat, lon, dt) {
    try {
        // Create a unique key for this location and timestamp
        const locationKey = createLocationKey(lat, lon, dt);

        const params = {
            TableName: WEATHER_CACHE_TABLE,
            Key: { locationKey }
        };

        const result = await dynamoDB.get(params).promise();

        if (result.Item) {
            console.log(`Cache hit for weather at ${locationKey}`);
            return result.Item.data;
        }

        console.log(`Cache miss for weather at ${locationKey}`);
        return null;
    } catch (error) {
        console.error('Error getting weather from cache:', error);
        return null; // Return null on error to fallback to API
    }
}

/**
 * Save weather data to the cache
 * @param {string} lat - Latitude
 * @param {string} lon - Longitude
 * @param {Object} data - The weather data to cache
 * @param {string} [dt] - Optional timestamp for historical weather
 * @returns {Promise<boolean>} - Whether the operation succeeded
 */
async function saveWeatherToCache(lat, lon, data, dt) {
    try {
        const now = Math.floor(Date.now() / 1000);
        const ttl = now + WEATHER_CACHE_TTL;

        // Create a unique key for this location and timestamp
        const locationKey = createLocationKey(lat, lon, dt);

        const params = {
            TableName: WEATHER_CACHE_TABLE,
            Item: {
                locationKey,
                data,
                lat,
                lon,
                dt: dt || null,
                ttl,
                timestamp: now
            }
        };

        await dynamoDB.put(params).promise();
        console.log(`Saved weather for ${locationKey} to cache with TTL ${ttl}`);
        return true;
    } catch (error) {
        console.error('Error saving weather to cache:', error);
        return false;
    }
}

/**
 * Creates a unique key for a location and optional timestamp
 * @param {string} lat - Latitude
 * @param {string} lon - Longitude
 * @param {string} [dt] - Optional timestamp
 * @returns {string} - A unique key
 */
function createLocationKey(lat, lon, dt) {
    // Round coordinates to 3 decimal places for better cache hits within small areas
    const roundedLat = parseFloat(lat).toFixed(3);
    const roundedLon = parseFloat(lon).toFixed(3);

    if (dt) {
        return `${roundedLat}:${roundedLon}:${dt}`;
    }
    return `${roundedLat}:${roundedLon}`;
}

/**
 * Clear expired cache entries (could be run periodically if needed)
 * @returns {Promise<Object>} - Results of the cleanup operation
 */
async function cleanupCache() {
    const now = Math.floor(Date.now() / 1000);
    const results = { segment: 0, weather: 0 };

    try {
        // DynamoDB TTL handles automatic deletion, but this could be used for manual cleanup
        // or additional tracking if needed

        console.log('Cache cleanup initiated');

        // For more comprehensive cleanup, you could implement a scan operation
        // to find and delete expired items, but typically DynamoDB TTL is sufficient

        return results;
    } catch (error) {
        console.error('Error cleaning up cache:', error);
        throw error;
    }
}

module.exports = {
    getSegmentFromCache,
    saveSegmentToCache,
    getWeatherFromCache,
    saveWeatherToCache,
    cleanupCache
};