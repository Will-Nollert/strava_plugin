// src/services/segmentService.js
import { getSegmentDetails, decodePolyline } from "../api.js";
import {
  getCachedSegmentDetails,
  shouldUseCachedApi,
} from "./stravaApiCache.js";

// In-memory cache for segment details to avoid repeated API calls within a session
const segmentCache = new Map();

/**
 * Get segment details with caching
 * @param {string} segmentId - Strava segment ID
 * @returns {Promise<Object>} Segment details
 */
async function getSegmentWithCache(segmentId) {
  // Check if segment is in local memory cache
  if (segmentCache.has(segmentId)) {
    console.log(`Using in-memory cache for segment ${segmentId}`);
    return segmentCache.get(segmentId);
  }

  try {
    let segment;

    // Determine whether to use backend cache API or direct Strava API
    const useCache = await shouldUseCachedApi();
    if (useCache) {
      console.log(`Fetching segment ${segmentId} from backend cache`);
      segment = await getCachedSegmentDetails(segmentId);
    } else {
      console.log(`Fetching segment ${segmentId} directly from Strava API`);
      segment = await getSegmentDetails(segmentId);
    }

    // Extract start and end points from polyline if available
    if (segment.map && segment.map.polyline) {
      // For simplicity we'll use the start point for weather
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

    // Cache the result in memory
    segmentCache.set(segmentId, segment);

    return segment;
  } catch (error) {
    console.error(`Error fetching segment ${segmentId}:`, error);
    throw error;
  }
}

/**
 * Calculate compass direction from start to end point
 * @param {Array} start - [lat, lng] of start point
 * @param {Array} end - [lat, lng] of end point
 * @returns {number} Direction in degrees (0-359)
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

export { getSegmentWithCache };
