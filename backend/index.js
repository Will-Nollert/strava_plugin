// AWS Lambda function to handle Strava OAuth securely
const axios = require("axios");

// Constants
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

// Headers for CORS
const headers = {
  "Access-Control-Allow-Origin": "*", // Replace with your extension ID in production
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  // Handle OPTIONS request (preflight)
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Preflight call successful" }),
    };
  }

  try {
    // Parse request path and body
    const path = event.path;
    const body = JSON.parse(event.body || "{}");

    // Route to appropriate handler
    if (path === "/token") {
      return await handleTokenExchange(body);
    } else if (path === "/refresh") {
      return await handleTokenRefresh(body);
    } else {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Endpoint not found" }),
      };
    }
  } catch (error) {
    console.error("Error processing request:", error);

    return {
      statusCode: 500,
      headers,
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
        headers,
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
      headers,
      body: JSON.stringify(response.data),
    };
  } catch (error) {
    console.error(
      "Token exchange error:",
      error.response?.data || error.message
    );

    return {
      statusCode: error.response?.status || 500,
      headers,
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
        headers,
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
      headers,
      body: JSON.stringify(response.data),
    };
  } catch (error) {
    console.error(
      "Token refresh error:",
      error.response?.data || error.message
    );

    return {
      statusCode: error.response?.status || 500,
      headers,
      body: JSON.stringify({
        message: "Token refresh failed",
        error: error.response?.data?.message || error.message,
      }),
    };
  }
}
