// src/api.js - Service for interacting with Strava API
import { getValidAccessToken } from "./auth.js";
import CONFIG from "./config.js";

/**
 * Performs an authenticated request to the Strava API
 * @param {string} endpoint - API endpoint (without base URL)
 * @param {Object} options - Fetch API options
 * @returns {Promise<any>} Response data
 */
async function apiRequest(endpoint, options = {}) {
  try {
    const accessToken = await getValidAccessToken();

    const url = `${CONFIG.STRAVA_API_BASE_URL}${endpoint}`;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // Handle 401 specially as it likely means token issues
      if (response.status === 401) {
        throw new Error("Authentication failed. Please log in again.");
      }

      const errorData = await response.json();
      throw new Error(errorData.message || response.statusText);
    }

    return response.json();
  } catch (error) {
    console.error("API request error:", error);
    throw error;
  }
}

/**
 * Gets a list of starred segments for the logged-in user
 * @param {number} page - Page number for pagination
 * @param {number} perPage - Number of items per page
 * @returns {Promise<Array>} List of starred segments
 */
async function getStarredSegments(page = 1, perPage = 30) {
  return apiRequest(`/segments/starred?page=${page}&per_page=${perPage}`);
}

/**
 * Gets detailed information about a specific segment
 * @param {string} segmentId - ID of the segment
 * @returns {Promise<Object>} Segment details
 */
async function getSegmentDetails(segmentId) {
  return apiRequest(`/segments/${segmentId}`);
}

/**
 * Gets the current logged-in athlete's profile
 * @returns {Promise<Object>} Athlete profile
 */
async function getAthleteProfile() {
  return apiRequest("/athlete");
}

/**
 * Extracts polyline data from segment and converts to coordinates
 * @param {string} segmentId - ID of the segment
 * @returns {Promise<Array>} Array of [lat, lng] coordinates
 */
async function getSegmentPolyline(segmentId) {
  const segmentDetails = await getSegmentDetails(segmentId);

  if (!segmentDetails.map || !segmentDetails.map.polyline) {
    throw new Error(`No polyline data available for segment ${segmentId}`);
  }

  // Convert the polyline to coordinates
  return decodePolyline(segmentDetails.map.polyline);
}

/**
 * Decodes a polyline string into an array of [latitude, longitude] coordinates
 * @param {string} encodedPolyline - Google encoded polyline string
 * @returns {Array} Array of [lat, lng] coordinates
 */
function decodePolyline(encodedPolyline) {
  let index = 0;
  const len = encodedPolyline.length;
  let lat = 0;
  let lng = 0;
  const coordinates = [];

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encodedPolyline.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encodedPolyline.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coordinates.push([lat * 1e-5, lng * 1e-5]);
  }

  return coordinates;
}

/**
 * Converts polyline coordinates to GPX format
 * @param {Array} coordinates - Array of [lat, lng] coordinates
 * @param {string} name - Name for the GPX track
 * @returns {string} GPX formatted XML string
 */
function convertToGPX(coordinates, name = "Strava Segment") {
  let gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="Strava Plugin v${
  CONFIG.VERSION
}" version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>`;

  coordinates.forEach(([lat, lng]) => {
    gpxContent += `
      <trkpt lat="${lat}" lon="${lng}">
        <ele>0</ele>
      </trkpt>`;
  });

  gpxContent += `
    </trkseg>
  </trk>
</gpx>`;

  return gpxContent;
}

/**
 * Escapes XML special characters
 * @param {string} unsafe - String that might contain XML special characters
 * @returns {string} Safe XML string
 */
function escapeXml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export {
  getStarredSegments,
  getSegmentDetails,
  getAthleteProfile,
  getSegmentPolyline,
  convertToGPX,
};
