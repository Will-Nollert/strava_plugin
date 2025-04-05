// src/background.js - Background service worker
import {
  getSegmentDetails,
  decodePolyline
} from "./api.js";
import {
  getCurrentWeather
} from "./services/weatherApi.js";
import {
  analyzeWeather
} from "./services/weatherAnalysis.js";

console.log("Strava Plugin Background Service Worker Initialized");

// Listen for messages from the popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "AUTH_CHECK") {
    // Handle auth check requests
    chrome.storage.local.get(["strava_auth_data"], (result) => {
      const isAuthenticated = !!(
        result.strava_auth_data && result.strava_auth_data.access_token
      );
      sendResponse({ isAuthenticated });
    });
    return true; // Required for async sendResponse
  }

  if (message.type === "TOKEN_REFRESH_NEEDED") {
    // Will be implemented if needed when tokens expire
    console.log("Token refresh requested");
    // Actual token refresh logic would go here
    sendResponse({ success: true });
    return true; // Required for async sendResponse
  }

  // Handle segment weather data requests from content script
  if (message.type === "GET_SEGMENT_WEATHER") {
    console.log("Segment weather requested for:", message.segmentId);
    handleSegmentWeather(message.segmentId)
      .then(analysis => {
        console.log("Weather analysis complete:", analysis ? analysis.level : "none");
        sendResponse({ success: true, analysis });
      })
      .catch(error => {
        console.error("Weather analysis error:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Required for async sendResponse
  }

  // Get segment details with cached data
  if (message.type === "GET_SEGMENT_DETAILS") {
    console.log("Segment details requested for:", message.segmentId);
    getSegmentWithCache(message.segmentId)
      .then(segment => {
        sendResponse({ success: true, segment });
      })
      .catch(error => {
        console.error("Segment details error:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Required for async sendResponse
  }
});

// Cache for segment details
const segmentCache = new Map();

/**
 * Get segment details with caching
 * @param {string} segmentId - Segment ID
 * @returns {Promise<Object>} Segment details
 */
async function getSegmentWithCache(segmentId) {
  // Check if segment is already in cache
  if (segmentCache.has(segmentId)) {
    return segmentCache.get(segmentId);
  }

  try {
    // Get segment details from Strava API
    const segment = await getSegmentDetails(segmentId);

    // Process polyline if available
    if (segment.map && segment.map.polyline) {
      // For simplicity we'll use the first point for weather
      const decodedPolyline = decodePolyline(segment.map.polyline);
      if (decodedPolyline.length > 0) {
        const startPoint = decodedPolyline[0];
        segment.start_latlng = startPoint;

        // Calculate rough direction if we have start and end points
        if (decodedPolyline.length > 1) {
          const endPoint = decodedPolyline[decodedPolyline.length - 1];
          segment.end_latlng = endPoint;
          segment.direction = calculateDirection(startPoint, endPoint);
        }
      }
    }

    // Cache the segment
    segmentCache.set(segmentId, segment);
    return segment;
  } catch (error) {
    console.error(`Error fetching segment ${segmentId}:`, error);
    throw error;
  }
}

/**
 * Calculate compass direction between two points
 * @param {Array} start - [lat, lng] start point
 * @param {Array} end - [lat, lng] end point
 * @returns {number} Direction in degrees
 */
function calculateDirection(start, end) {
  const [lat1, lng1] = start;
  const [lat2, lng2] = end;

  const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360; // Normalize to 0-359
}

/**
 * Process weather data for a segment
 * @param {string} segmentId - Segment ID
 * @returns {Promise<Object>} Weather analysis
 */
async function handleSegmentWeather(segmentId) {
  try {
    // Get segment details
    const segment = await getSegmentWithCache(segmentId);

    // Get weather for segment location
    if (!segment.start_latlng) {
      throw new Error("Segment location data not available");
    }

    const [lat, lng] = segment.start_latlng;
    const weather = await getCurrentWeather(lat, lng);

    // Analyze weather conditions for this segment
    return analyzeWeather(weather, segment);
  } catch (error) {
    console.error(`Error processing weather for segment ${segmentId}:`, error);
    throw error;
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