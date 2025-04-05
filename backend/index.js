// AWS Lambda function to handle Strava OAuth and Weather API securely with caching
const axios = require("axios");
const cacheService = require("./services/cacheService");

// Constants
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API_BASE_URL = "https://www.strava.com/api/v3";
const OPENWEATHER_CURRENT_URL = "https://api.openweathermap.org/data/3.0/onecall";
const OPENWEATHER_HISTORICAL_URL = "https://api.openweathermap.org/data/3.0/onecall/timemachine";
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const WEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

/**
 * Generate dynamic CORS headers based on request origin
 * @param {Object} event - Lambda event object 
 * @returns {Object} CORS headers
 */
function getCorsHeaders(event) {
  // Get origin from request headers (case insensitive)
  const origin = event.headers.origin || event.headers.Origin;

  // If no origin or it's not from Strava domain, use wildcard
  // Otherwise use the exact origin from the request
  const allowOrigin = origin && (
    origin === "https://www.strava.com" ||
    origin.includes("strava.com")
  ) ? origin : "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, authorization",
    "Access-Control-Allow-Credentials": "true"
  };
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  // Get dynamic CORS headers based on request
  const corsHeaders = getCorsHeaders(event);

  // Handle OPTIONS request (preflight)
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Preflight call successful" })
    };
  }

  try {
    // Parse request path and body
    const path = event.path;

    // Route to appropriate handler
    if (path === "/token") {
      return await handleTokenExchange(JSON.parse(event.body || "{}"), corsHeaders);
    } else if (path === "/refresh") {
      return await handleTokenRefresh(JSON.parse(event.body || "{}"), corsHeaders);
    } else if (path === "/weather") {
      return await handleWeatherRequest(event, corsHeaders);
    } else if (path.startsWith("/segment/")) {
      const segmentId = event.pathParameters?.segmentId;
      return await handleSegmentRequest(segmentId, event, corsHeaders);
    } else if (path === "/segments/starred") {
      return await handleStarredSegmentsRequest(event, corsHeaders);
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
async function handleTokenExchange(body, corsHeaders) {
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
async function handleTokenRefresh(body, corsHeaders) {
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
 * Handles weather API requests with caching
 */
async function handleWeatherRequest(event, corsHeaders) {
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

    // Try to get data from cache first
    const cachedData = await cacheService.getWeatherFromCache(lat, lon, dt);
    if (cachedData) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(cachedData),
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

    // Save to cache
    await cacheService.saveWeatherToCache(lat, lon, response.data, dt);

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

/**
 * Handles segment requests with caching
 */
async function handleSegmentRequest(segmentId, event, corsHeaders) {
  try {
    if (!segmentId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Missing segment ID" }),
      };
    }

    // Extract authorization token from header
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Authorization header required" }),
      };
    }

    // Try to get data from cache first
    const cachedData = await cacheService.getSegmentFromCache(segmentId);
    if (cachedData) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(cachedData),
      };
    }

    // If not in cache, forward request to Strava API
    const response = await axios.get(`${STRAVA_API_BASE_URL}/segments/${segmentId}`, {
      headers: {
        Authorization: authHeader,
      },
    });

    // Save to cache
    await cacheService.saveSegmentToCache(segmentId, response.data);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response.data),
    };
  } catch (error) {
    console.error("Segment API error:", error.response?.data || error.message);

    return {
      statusCode: error.response?.status || 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Segment API request failed",
        error: error.response?.data?.message || error.message,
      }),
    };
  }
}

/**
 * Handles starred segments requests
 * Note: We don't cache the list of starred segments as it changes frequently
 */
async function handleStarredSegmentsRequest(event, corsHeaders) {
  try {
    // Extract authorization token from header
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Authorization header required" }),
      };
    }

    // Extract query parameters
    const { page, per_page } = event.queryStringParameters || {};

    // Forward request to Strava API
    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', page);
    if (per_page) queryParams.append('per_page', per_page);

    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const response = await axios.get(`${STRAVA_API_BASE_URL}/segments/starred${queryString}`, {
      headers: {
        Authorization: authHeader,
      },
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response.data),
    };
  } catch (error) {
    console.error("Starred segments API error:", error.response?.data || error.message);

    return {
      statusCode: error.response?.status || 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Starred segments API request failed",
        error: error.response?.data?.message || error.message,
      }),
    };
  }
}