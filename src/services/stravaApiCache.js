// src/services/stravaApiCache.js
import { getValidAccessToken } from "../auth.js";
import CONFIG from "../config.js";

/**
 * Get cached segment details from the server
 * @param {string} segmentId - Strava segment ID
 * @returns {Promise<Object>} Segment details
 */
export async function getCachedSegmentDetails(segmentId) {
  try {
    const accessToken = await getValidAccessToken();
    const url = `${CONFIG.AUTH_PROXY_URL}/segment/${segmentId}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      // Handle 401 specially as it likely means token issues
      if (response.status === 401) {
        throw new Error("Authentication failed. Please log in again.");
      }

      const errorData = await response.json();
      throw new Error(errorData.message || response.statusText);
    }

    return response.json();
  } catch (error) {
    console.error(`Error fetching cached segment ${segmentId}:`, error);
    throw error;
  }
}

/**
 * Get current weather data using the cached weather API
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} Weather data
 */
export async function getCachedWeather(lat, lon) {
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
 * Check if we should use cached API or direct Strava API
 * @returns {Promise<boolean>} True if we should use cached API
 */
export async function shouldUseCachedApi() {
  try {
    // Import the settings service dynamically to avoid circular dependencies
    const { getSettings } = await import("./settingsService.js");
    const settings = await getSettings();
    return settings.useCache;
  } catch (error) {
    console.error("Error checking cache settings:", error);
    // Default to true if there's an error
    return true;
  }
}
