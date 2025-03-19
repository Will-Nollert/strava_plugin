// src/auth.js - Handles Strava OAuth authentication securely
import CONFIG from "./config.js";

/**
 * Initiates the OAuth flow with Strava
 * @returns {Promise<Object>} The authentication result with tokens
 */
async function authenticate() {
  try {
    // Step 1: Get authorization code via browser-based OAuth flow
    const authCode = await getAuthorizationCode();

    // Step 2: Exchange authorization code for access token via backend proxy
    const tokens = await exchangeCodeForTokens(authCode);

    // Step 3: Save tokens to local storage
    await saveAuthData(tokens);

    return tokens;
  } catch (error) {
    console.error("Authentication error:", error);
    throw error;
  }
}

/**
 * Gets an authorization code from Strava via OAuth
 * @returns {Promise<string>} Authorization code
 */
function getAuthorizationCode() {
  return new Promise((resolve, reject) => {
    const authUrl = new URL(CONFIG.STRAVA_AUTH_URL);
    authUrl.searchParams.append("client_id", CONFIG.STRAVA_CLIENT_ID);
    authUrl.searchParams.append("redirect_uri", CONFIG.REDIRECT_URL);
    authUrl.searchParams.append("response_type", CONFIG.RESPONSE_TYPE);
    authUrl.searchParams.append("scope", CONFIG.OAUTH_SCOPE);

    // Use chrome.identity API to launch the auth flow in a popup
    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl.toString(),
        interactive: true,
      },
      (redirectUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!redirectUrl) {
          reject(new Error("Authorization failed. No redirect URL returned."));
          return;
        }

        // Extract the authorization code from the redirect URL
        const url = new URL(redirectUrl);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          reject(new Error(`Authorization error: ${error}`));
          return;
        }

        if (!code) {
          reject(new Error("No authorization code found in the redirect URL."));
          return;
        }

        resolve(code);
      }
    );
  });
}

/**
 * Exchanges an authorization code for access and refresh tokens using the secure backend proxy
 * @param {string} authCode - The authorization code from Strava
 * @returns {Promise<Object>} Object containing access_token, refresh_token, and expires_at
 */
async function exchangeCodeForTokens(authCode) {
  try {
    // The backend proxy handles the client secret securely
    const response = await fetch(`${CONFIG.AUTH_PROXY_URL}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: authCode,
        client_id: CONFIG.STRAVA_CLIENT_ID,
        redirect_uri: CONFIG.REDIRECT_URL,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Token exchange failed: ${errorData.message || response.statusText}`
      );
    }

    const tokenData = await response.json();

    // Add timestamp for when we received the token
    tokenData.received_at = Math.floor(Date.now() / 1000);

    return tokenData;
  } catch (error) {
    console.error("Error exchanging code for tokens:", error);
    throw error;
  }
}

/**
 * Saves authentication data to Chrome storage
 * @param {Object} authData - The authentication data to save
 * @returns {Promise<void>}
 */
function saveAuthData(authData) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [CONFIG.STORAGE_KEY]: authData }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Retrieves saved authentication data from Chrome storage
 * @returns {Promise<Object|null>} The stored auth data or null if not found
 */
function getAuthData() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([CONFIG.STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result[CONFIG.STORAGE_KEY] || null);
      }
    });
  });
}

/**
 * Refreshes the access token using the refresh token via the secure backend proxy
 * @returns {Promise<Object>} The new authentication data
 */
async function refreshAccessToken() {
  try {
    const authData = await getAuthData();

    if (!authData || !authData.refresh_token) {
      throw new Error("No refresh token available. Please authenticate again.");
    }

    // Use the secure backend to refresh the token
    const response = await fetch(`${CONFIG.AUTH_PROXY_URL}/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh_token: authData.refresh_token,
        client_id: CONFIG.STRAVA_CLIENT_ID,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Token refresh failed: ${errorData.message || response.statusText}`
      );
    }

    const newAuthData = await response.json();

    // Update received timestamp
    newAuthData.received_at = Math.floor(Date.now() / 1000);

    // Preserve the refresh token if the API doesn't return one
    if (!newAuthData.refresh_token && authData.refresh_token) {
      newAuthData.refresh_token = authData.refresh_token;
    }

    await saveAuthData(newAuthData);

    return newAuthData;
  } catch (error) {
    console.error("Token refresh error:", error);
    throw error;
  }
}

/**
 * Checks if the current token is valid, refreshes if needed
 * @returns {Promise<string>} A valid access token
 */
async function getValidAccessToken() {
  try {
    let authData = await getAuthData();

    if (!authData) {
      throw new Error("No authentication data found. Please authenticate.");
    }

    // Token is considered expired if it's within 5 minutes of expiration
    // Use received_at and expires_in for more accurate expiration calculation
    const currentTime = Math.floor(Date.now() / 1000);
    const expirationTime = authData.received_at + authData.expires_in - 300; // 5 minute buffer

    if (currentTime >= expirationTime) {
      // Token is expired or about to expire, refresh it
      authData = await refreshAccessToken();
    }

    return authData.access_token;
  } catch (error) {
    console.error("Error getting valid access token:", error);
    throw error;
  }
}

/**
 * Clears authentication data from storage
 * @returns {Promise<void>}
 */
function logout() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove([CONFIG.STORAGE_KEY], () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

export {
  authenticate,
  getAuthData,
  getValidAccessToken,
  refreshAccessToken,
  logout,
};
