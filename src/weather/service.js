// src/weather/service.js - Service for managing weather data fetching and caching
import { getEnhancedWeatherData } from "./api.js";
import { analyzeWeatherImpact } from "./analysis.js";
import WEATHER_CONFIG from "./config.js";

// Cache key prefix for weather data
const WEATHER_CACHE_PREFIX = WEATHER_CONFIG.CACHE_PREFIX;
// Cache expiration from config
const CACHE_EXPIRATION = WEATHER_CONFIG.CACHE_EXPIRATION;

/**
 * Generate a cache key for weather data
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} timestamp - Unix timestamp
 * @returns {string} - Cache key
 */
function generateCacheKey(lat, lng, timestamp) {
  // Round coordinates to 3 decimal places (approx. 110m precision)
  const roundedLat = Math.round(lat * 1000) / 1000;
  const roundedLng = Math.round(lng * 1000) / 1000;

  // Round timestamp to nearest hour for better cache hits
  const roundedTimestamp = Math.floor(timestamp / 3600) * 3600;

  return `${WEATHER_CACHE_PREFIX}${roundedLat}_${roundedLng}_${roundedTimestamp}`;
}

/**
 * Get cached weather data if available
 * @param {string} cacheKey - Cache key for the weather data
 * @returns {Promise<Object|null>} - Cached weather data or null if not found
 */
function getCachedWeatherData(cacheKey) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([cacheKey], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      const cachedData = result[cacheKey];

      if (!cachedData) {
        resolve(null);
        return;
      }

      // Check if cache is still valid
      const now = Date.now();
      if (now - cachedData.cachedAt > CACHE_EXPIRATION) {
        // Cache expired
        chrome.storage.local.remove([cacheKey]);
        resolve(null);
        return;
      }

      resolve(cachedData.data);
    });
  });
}

/**
 * Cache weather data for future use
 * @param {string} cacheKey - Cache key for the weather data
 * @param {Object} data - Weather data to cache
 * @returns {Promise<void>}
 */
function cacheWeatherData(cacheKey, data) {
  return new Promise((resolve, reject) => {
    const cacheObject = {
      data,
      cachedAt: Date.now(),
    };

    chrome.storage.local.set({ [cacheKey]: cacheObject }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Get weather data for a specific location and time
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} timestamp - Unix timestamp (in seconds)
 * @param {boolean} useCache - Whether to use cached data if available
 * @returns {Promise<Object>} - Weather data
 */
async function getWeatherData(lat, lng, timestamp, useCache = true) {
  try {
    if (!timestamp) {
      timestamp = Math.floor(Date.now() / 1000);
    }

    // Try to get from cache if allowed
    if (useCache) {
      const cacheKey = generateCacheKey(lat, lng, timestamp);
      const cachedData = await getCachedWeatherData(cacheKey);

      if (cachedData) {
        console.log("Using cached weather data:", cacheKey);
        return cachedData;
      }
    }

    // Fetch fresh weather data
    console.log(
      "Fetching fresh weather data for:",
      lat,
      lng,
      new Date(timestamp * 1000)
    );
    const weatherData = await getEnhancedWeatherData(lat, lng, timestamp);

    // Cache the data for future use
    if (useCache) {
      const cacheKey = generateCacheKey(lat, lng, timestamp);
      await cacheWeatherData(cacheKey, weatherData);
    }

    return weatherData;
  } catch (error) {
    console.error("Failed to get weather data:", error);
    throw error;
  }
}

/**
 * Clear all cached weather data
 * @returns {Promise<void>}
 */
function clearWeatherCache() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(null, (items) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      const weatherKeys = Object.keys(items).filter((key) =>
        key.startsWith(WEATHER_CACHE_PREFIX)
      );

      if (weatherKeys.length === 0) {
        resolve();
        return;
      }

      chrome.storage.local.remove(weatherKeys, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  });
}

/**
 * Get weather impact analysis for a segment effort
 * @param {Object} segment - Segment data
 * @param {number} timestamp - Timestamp when the segment was completed
 * @returns {Promise<Object>} - Weather impact analysis
 */
async function getWeatherImpact(segment, timestamp) {
  try {
    // Get middle point of segment for weather data
    // In a real implementation, you might want to get weather at multiple points along the segment
    const startLat = segment.start_latlng[0];
    const startLng = segment.start_latlng[1];
    const endLat = segment.end_latlng[0];
    const endLng = segment.end_latlng[1];

    const midLat = (startLat + endLat) / 2;
    const midLng = (startLng + endLng) / 2;

    // Get weather data for the segment
    const weatherData = await getWeatherData(midLat, midLng, timestamp);

    // Analyze weather impact
    const weatherImpact = analyzeWeatherImpact(segment, weatherData);

    return weatherImpact;
  } catch (error) {
    console.error("Failed to get weather impact:", error);
    throw error;
  }
}

export { getWeatherData, getWeatherImpact, clearWeatherCache };
