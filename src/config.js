// src/config.js - Centralized configuration for the extension

/**
 * Extension configuration
 * Only contains non-sensitive information that can be safely included in the extension
 */
const CONFIG = {
  // Strava API endpoints
  STRAVA_API_BASE_URL: "https://www.strava.com/api/v3",
  STRAVA_AUTH_URL: "https://www.strava.com/oauth/authorize",

  // Your backend proxy service URL from AWS deployment
  AUTH_PROXY_URL: "https://25qbhav42d.execute-api.us-east-1.amazonaws.com/prod",

  // Client ID for Strava API (replace with your actual client ID)
  STRAVA_CLIENT_ID: "78460",

  // OAuth configuration
  REDIRECT_URL: chrome.identity
    ? chrome.identity.getRedirectURL()
    : "urn:ietf:wg:oauth:2.0:oob",
  OAUTH_SCOPE: "read,activity:read",
  RESPONSE_TYPE: "code",

  // Storage keys
  STORAGE_KEY: "strava_auth_data",

  // Extension version
  VERSION: chrome.runtime?.getManifest()?.version || "dev",
};

export default CONFIG;
