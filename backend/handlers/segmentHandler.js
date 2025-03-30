// backend/handlers/segmentHandler.js
const axios = require("axios");
const cacheService = require("../services/cacheService");

// Constants
const STRAVA_API_BASE_URL = "https://www.strava.com/api/v3";

/**
 * Get the segment details from Strava API
 * @param {string} segmentId - The Strava segment ID
 * @param {string} accessToken - The Strava access token
 * @returns {Promise<Object>} - The segment details
 */
async function fetchSegmentFromStrava(segmentId, accessToken) {
  try {
    const response = await axios.get(
      `${STRAVA_API_BASE_URL}/segments/${segmentId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      `Error fetching segment ${segmentId} from Strava:`,
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Handle segment API requests
 * @param {Object} event - API Gateway event
 * @param {Object} corsHeaders - CORS headers for response
 * @returns {Promise<Object>} - API Gateway response
 */
async function handleSegmentRequest(event, corsHeaders) {
  // Handle OPTIONS request for preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Preflight call successful" }),
    };
  }

  try {
    // Extract segment ID from path and access token from headers
    const segmentId = event.pathParameters?.segmentId;
    const authHeader =
      event.headers?.Authorization || event.headers?.authorization;

    if (!segmentId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Missing segment ID" }),
      };
    }

    if (!authHeader) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Missing authorization header" }),
      };
    }

    // Extract access token
    const accessToken = authHeader.replace("Bearer ", "");

    // Try to get from cache first
    const cachedSegment = await cacheService.getCachedItem(
      segmentId,
      cacheService.CacheType.SEGMENT
    );

    if (cachedSegment) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(cachedSegment),
      };
    }

    // Not in cache, fetch from Strava
    const segmentData = await fetchSegmentFromStrava(segmentId, accessToken);

    // Store in cache
    cacheService
      .setCachedItem(segmentId, cacheService.CacheType.SEGMENT, segmentData)
      .catch((err) => console.error("Error caching segment:", err));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(segmentData),
    };
  } catch (error) {
    console.error("Error in segment request:", error);

    // Handle Strava API specific errors
    if (error.response) {
      return {
        statusCode: error.response.status || 500,
        headers: corsHeaders,
        body: JSON.stringify({
          message: "Segment request failed",
          error: error.response.data?.message || error.message,
        }),
      };
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Segment request failed",
        error: error.message,
      }),
    };
  }
}

module.exports = {
  handleSegmentRequest,
};
