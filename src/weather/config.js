// src/weather/config.js
import CONFIG from "../config.js";

const WEATHER_CONFIG = {
  // We no longer store the API key directly in the frontend
  // Instead, we use our backend proxy
  PROXY_URL: `${CONFIG.AUTH_PROXY_URL}/weather`,

  // We still need units configuration for calculations
  UNITS: "metric", // Use metric units (for wind speed in m/s, temp in Celsius)

  // Cache configuration
  CACHE_EXPIRATION: 48 * 60 * 60 * 1000, // 48 hours in milliseconds
  CACHE_PREFIX: "weather_data_",
};

export default WEATHER_CONFIG;
