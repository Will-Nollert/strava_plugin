// src/background.js - Background service worker with weather integration
import { getValidAccessToken, refreshAccessToken } from "./auth.js";
import { getSegmentDetails, getSegmentEfforts } from "./api.js";
import { getWeatherImpact } from "./weather/service.js";

console.log("Strava Plugin Background Service Worker Initialized");

// Listen for messages from the popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Auth check requests
  if (message.type === "AUTH_CHECK") {
    chrome.storage.local.get(["strava_auth_data"], (result) => {
      const isAuthenticated = !!(
        result.strava_auth_data && result.strava_auth_data.access_token
      );
      sendResponse({ isAuthenticated });
    });
    return true; // Required for async sendResponse
  }

  // Token refresh requests
  if (message.type === "TOKEN_REFRESH_NEEDED") {
    refreshAccessToken()
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("Token refresh error:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Required for async sendResponse
  }

  // Get segment details request (from content script)
  if (message.type === "GET_SEGMENT_DETAILS") {
    handleGetSegmentDetails(message, sendResponse);
    return true; // Required for async sendResponse
  }

  // Get segment efforts request (from content script)
  if (message.type === "GET_SEGMENT_EFFORTS") {
    handleGetSegmentEfforts(message, sendResponse);
    return true; // Required for async sendResponse
  }

  // Get weather impact request (from content script)
  if (message.type === "GET_WEATHER_IMPACT") {
    handleGetWeatherImpact(message, sendResponse);
    return true; // Required for async sendResponse
  }
});

/**
 * Handle request to get segment details
 * @param {Object} message - The request message
 * @param {Function} sendResponse - Function to send response
 */
async function handleGetSegmentDetails(message, sendResponse) {
  try {
    // Ensure we have a valid access token
    await getValidAccessToken();

    // Get segment details
    const segmentDetails = await getSegmentDetails(message.segmentId);

    // Send the response
    sendResponse({
      success: true,
      data: segmentDetails,
    });
  } catch (error) {
    console.error("Error getting segment details:", error);
    sendResponse({
      success: false,
      error: error.message || "Failed to get segment details",
    });
  }
}

/**
 * Handle request to get segment efforts
 * @param {Object} message - The request message
 * @param {Function} sendResponse - Function to send response
 */
async function handleGetSegmentEfforts(message, sendResponse) {
  try {
    // Ensure we have a valid access token
    await getValidAccessToken();

    // Get segment efforts
    const limit = message.limit || 10;
    const efforts = await getSegmentEfforts(message.segmentId, 1, limit);

    // Send the response
    sendResponse({
      success: true,
      data: efforts,
    });
  } catch (error) {
    console.error("Error getting segment efforts:", error);
    sendResponse({
      success: false,
      error: error.message || "Failed to get segment efforts",
    });
  }
}

/**
 * Handle request to get weather impact
 * @param {Object} message - The request message
 * @param {Function} sendResponse - Function to send response
 */
async function handleGetWeatherImpact(message, sendResponse) {
  try {
    // Get weather impact for the segment
    const weatherImpact = await getWeatherImpact(
      message.segment,
      message.timestamp
    );

    // Send the response
    sendResponse({
      success: true,
      data: weatherImpact,
    });
  } catch (error) {
    console.error("Error getting weather impact:", error);
    sendResponse({
      success: false,
      error: error.message || "Failed to get weather impact",
    });
  }
}

// Handle installation and updates
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("Extension installed");
    // You could open a welcome page or tutorial here
  } else if (details.reason === "update") {
    console.log("Extension updated");
    // You could show release notes or changelog here
  }
});

// Keep the service worker alive by responding to pings
// (Only needed if you're doing long-lived operations in the background)
// chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
// chrome.alarms.onAlarm.addListener((alarm) => {
//   if (alarm.name === 'keepAlive') {
//     console.log('Background service worker is still active');
//   }
// });
