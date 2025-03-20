// src/weather/api.js - Service for fetching weather data
import WEATHER_CONFIG from "./config.js";

/**
 * Fetches historical weather data for a specific location and time
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} timestamp - Unix timestamp (in seconds)
 * @returns {Promise<Object>} - Weather data object
 */
async function getHistoricalWeather(lat, lng, timestamp) {
  try {
    // Use the backend proxy instead of calling OpenWeatherMap directly
    const url = new URL(WEATHER_CONFIG.PROXY_URL);
    url.searchParams.append("lat", lat);
    url.searchParams.append("lon", lng);
    url.searchParams.append("dt", timestamp);

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Weather API error: ${errorData.message || response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching historical weather data:", error);
    throw error;
  }
}

/**
 * Fetches current weather data for a specific location
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Object>} - Weather data object
 */
async function getCurrentWeather(lat, lng) {
  try {
    // Use the backend proxy instead of calling OpenWeatherMap directly
    const url = new URL(WEATHER_CONFIG.PROXY_URL);
    url.searchParams.append("lat", lat);
    url.searchParams.append("lon", lng);
    // No timestamp means current weather

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Weather API error: ${errorData.message || response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching current weather data:", error);
    throw error;
  }
}

/**
 * Calculate air density based on temperature, humidity, and pressure
 * @param {number} temp - Temperature in Celsius
 * @param {number} humidity - Relative humidity (0-100)
 * @param {number} pressure - Atmospheric pressure in hPa
 * @returns {number} - Air density in kg/m³
 */
function calculateAirDensity(temp, humidity, pressure) {
  // Constants
  const R = 287.05; // Specific gas constant for dry air, J/(kg·K)
  const Rv = 461.495; // Specific gas constant for water vapor, J/(kg·K)

  // Convert temperature to Kelvin
  const tempK = temp + 273.15;

  // Calculate saturation vapor pressure (hPa)
  const es = 6.1078 * Math.exp((17.27 * temp) / (temp + 237.3));

  // Calculate actual vapor pressure (hPa)
  const e = (humidity / 100) * es;

  // Calculate dry air pressure (hPa)
  const pd = pressure - e;

  // Calculate air density using the formula for moist air
  const density = (pd * 100) / (R * tempK) + (e * 100) / (Rv * tempK);

  return density;
}

/**
 * Fetch complete weather data and add derived metrics like air density
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} timestamp - Unix timestamp (in seconds), optional for historical data
 * @returns {Promise<Object>} - Enhanced weather data with derived metrics
 */
async function getEnhancedWeatherData(lat, lng, timestamp = null) {
  try {
    let weatherData;

    if (timestamp) {
      weatherData = await getHistoricalWeather(lat, lng, timestamp);
    } else {
      weatherData = await getCurrentWeather(lat, lng);
    }

    // Extract main weather parameters
    // The structure depends on the OpenWeatherMap API response format
    // We need to adapt this based on the actual response from our backend
    const data = timestamp ? weatherData.data[0] : weatherData.current;

    // Add calculated air density
    const airDensity = calculateAirDensity(
      data.temp,
      data.humidity,
      data.pressure
    );

    return {
      ...data,
      air_density: airDensity,
      timestamp: timestamp || Math.floor(Date.now() / 1000),
      source: "OpenWeatherMap via backend proxy",
    };
  } catch (error) {
    console.error("Error getting enhanced weather data:", error);
    throw error;
  }
}

export {
  getHistoricalWeather,
  getCurrentWeather,
  getEnhancedWeatherData,
  calculateAirDensity,
};
