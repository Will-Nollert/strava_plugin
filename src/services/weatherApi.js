// src/services/weatherApi.js
import CONFIG from "../config.js";

/**
 * Gets current weather data for a specific location
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} Weather data
 */
async function getCurrentWeather(lat, lon) {
  try {
    const url = new URL(`${CONFIG.AUTH_PROXY_URL}/weather`);
    url.searchParams.append("lat", lat);
    url.searchParams.append("lon", lon);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.statusText}`);
    }

    return await response.json();
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
