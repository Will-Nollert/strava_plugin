// AWS Lambda function to handle Strava OAuth and Weather API securely
const axios = require("axios");

// Constants
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const OPENWEATHER_CURRENT_URL =
  "https://api.openweathermap.org/data/3.0/onecall";
const OPENWEATHER_HISTORICAL_URL =
  "https://api.openweathermap.org/data/3.0/onecall/timemachine";
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const WEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

// Headers for CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Replace with your extension ID in production
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Simple CORS response for OPTIONS
const corsResponse = {
  statusCode: 200,
  headers: corsHeaders,
  body: JSON.stringify({ message: "Preflight call successful" }),
};

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  // Handle OPTIONS request (preflight)
  if (event.httpMethod === "OPTIONS") {
    return corsResponse;
  }

  try {
    // Parse request path and body
    const path = event.path;

    // Route to appropriate handler
    if (path === "/token") {
      return await handleTokenExchange(JSON.parse(event.body || "{}"));
    } else if (path === "/refresh") {
      return await handleTokenRefresh(JSON.parse(event.body || "{}"));
    } else if (path === "/weather") {
      return await handleWeatherRequest(event);
    } else {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Endpoint not found" }),
      };
    }
  } catch (error) {
    console.error("Error processing request:", error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Internal server error",
        error: error.message,
      }),
    };
  }
};

/**
 * Handles initial token exchange
 */
async function handleTokenExchange(body) {
  try {
    // Validate required fields
    if (!body.code || !body.client_id) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Missing required parameters" }),
      };
    }

    // Make request to Strava API
    const response = await axios.post(STRAVA_TOKEN_URL, {
      client_id: body.client_id,
      client_secret: CLIENT_SECRET,
      code: body.code,
      grant_type: "authorization_code",
    });

    // Return token data
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response.data),
    };
  } catch (error) {
    console.error(
      "Token exchange error:",
      error.response?.data || error.message
    );

    return {
      statusCode: error.response?.status || 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Token exchange failed",
        error: error.response?.data?.message || error.message,
      }),
    };
  }
}

/**
 * Handles token refresh
 */
async function handleTokenRefresh(body) {
  try {
    // Validate required fields
    if (!body.refresh_token || !body.client_id) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Missing required parameters" }),
      };
    }

    // Make request to Strava API
    const response = await axios.post(STRAVA_TOKEN_URL, {
      client_id: body.client_id,
      client_secret: CLIENT_SECRET,
      refresh_token: body.refresh_token,
      grant_type: "refresh_token",
    });

    // Return token data
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response.data),
    };
  } catch (error) {
    console.error(
      "Token refresh error:",
      error.response?.data || error.message
    );

    return {
      statusCode: error.response?.status || 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Token refresh failed",
        error: error.response?.data?.message || error.message,
      }),
    };
  }
}

/**
 * Handles weather API requests
 */
async function handleWeatherRequest(event) {
  try {
    // Extract query parameters
    const { lat, lon, dt } = event.queryStringParameters || {};

    // Validate required fields
    if (!lat || !lon) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          message: "Missing required parameters lat/lon",
        }),
      };
    }

    // Determine if this is a historical or current request
    const isHistorical = !!dt;
    const baseUrl = isHistorical
      ? OPENWEATHER_HISTORICAL_URL
      : OPENWEATHER_CURRENT_URL;

    // Prepare request URL
    const params = {
      lat,
      lon,
      appid: WEATHER_API_KEY,
      units: "metric",
    };

    // Add timestamp for historical requests
    if (isHistorical) {
      params.dt = dt;
    } else {
      // For current weather, exclude unnecessary data
      params.exclude = "minutely,daily,alerts";
    }

    // Make request to OpenWeatherMap
    const response = await axios.get(baseUrl, { params });

    // Return weather data
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response.data),
    };
  } catch (error) {
    console.error("Weather API error:", error.response?.data || error.message);

    return {
      statusCode: error.response?.status || 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Weather API request failed",
        error: error.response?.data?.message || error.message,
      }),
    };
  }
}
