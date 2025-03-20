// src/services/segmentService.js
import { getSegmentDetails, decodePolyline } from "../api.js";

// Cache for segment details to avoid repeated API calls
const segmentCache = new Map();

/**
 * Get segment details with caching
 * @param {string} segmentId - Strava segment ID
 * @returns {Promise<Object>} Segment details
 */
async function getSegmentWithCache(segmentId) {
  // Check if segment is in cache
  if (segmentCache.has(segmentId)) {
    return segmentCache.get(segmentId);
  }

  try {
    const segment = await getSegmentDetails(segmentId);

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

    // Cache the result
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
