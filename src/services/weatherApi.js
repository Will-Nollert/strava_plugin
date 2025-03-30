// src/services/weatherApi.js
import CONFIG from "../config.js";
import { getCachedWeather } from "./stravaApiCache.js";

// In-memory cache for weather data to avoid excessive API calls
const weatherCache = new Map();
const WEATHER_CACHE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds

/**
 * Gets current weather data for a specific location
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} Weather data
 */
async function getCurrentWeather(lat, lon) {
  try {
    // Round coordinates to reduce number of cache entries (within ~110m radius)
    const roundedLat = parseFloat(lat).toFixed(3);
    const roundedLon = parseFloat(lon).toFixed(3);
    const cacheKey = `${roundedLat},${roundedLon}`;

    // Check in-memory cache first
    const cachedData = weatherCache.get(cacheKey);
    if (cachedData && Date.now() - cachedData.timestamp < WEATHER_CACHE_TTL) {
      console.log(`Using in-memory cache for weather at ${cacheKey}`);
      return cachedData.data;
    }

    // Fetch from backend (which has its own caching)
    console.log(`Fetching weather for ${cacheKey} from backend`);
    const weatherData = await getCachedWeather(roundedLat, roundedLon);

    // Store in memory cache
    weatherCache.set(cacheKey, {
      data: weatherData,
      timestamp: Date.now(),
    });

    return weatherData;
  } catch (error) {
    console.error("Error fetching weather data:", error);
    throw error;
  }
}

/**
 * Gets historical weather data for a specific location and time
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} timestamp - Unix timestamp
 * @returns {Promise<Object>} Historical weather data
 */
async function getHistoricalWeather(lat, lon, timestamp) {
  try {
    const url = new URL(`${CONFIG.AUTH_PROXY_URL}/weather`);
    url.searchParams.append("lat", lat);
    url.searchParams.append("lon", lon);
    url.searchParams.append("dt", timestamp);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Historical weather API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching historical weather data:", error);
    throw error;
  }
}

export { getCurrentWeather, getHistoricalWeather };
