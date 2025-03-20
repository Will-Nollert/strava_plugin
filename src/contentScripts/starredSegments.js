// src/contentScripts/starredSegments.js
import { getCurrentWeather } from "../services/weatherApi.js";
import { analyzeWeather, AssistLevel } from "../services/weatherAnalysis.js";
import { getSegmentWithCache } from "../services/segmentService.js";

console.log("Strava Plugin: Content script loaded for starred segments page");

// Map to store weather data and analysis for segments
const segmentWeatherMap = new Map();

/**
 * Function to add the weather assist column
 */
async function addWeatherAssistColumn() {
  // Get the table
  const table = document.querySelector("table.starred-segments");
  if (!table) {
    console.error("Strava Plugin: Could not find starred segments table");
    return;
  }

  // Add header column
  const headerRow = table.querySelector("thead tr");
  if (headerRow) {
    const weatherHeader = document.createElement("th");
    weatherHeader.textContent = "Weather Assist";
    headerRow.appendChild(weatherHeader);
  }

  // Add data cells to each row with loading state
  const rows = table.querySelectorAll("tbody tr");
  const segmentPromises = [];

  rows.forEach((row) => {
    // Extract segment ID from the row
    const segmentLink = row.querySelector("td:nth-child(3) a");
    let segmentId = "";
    if (segmentLink) {
      const href = segmentLink.getAttribute("href");
      segmentId = href.split("/").pop();
    }

    // Store segment ID as a data attribute
    const weatherCell = document.createElement("td");
    weatherCell.dataset.segmentId = segmentId;
    weatherCell.textContent = "Loading...";
    weatherCell.style.color = "gray";
    weatherCell.style.fontStyle = "italic";

    row.appendChild(weatherCell);

    // Add to promises for batch processing
    if (segmentId) {
      const promise = processSegmentWeather(segmentId)
        .then((analysis) => {
          // Update the cell with the analysis result
          updateWeatherCell(weatherCell, analysis);
        })
        .catch((error) => {
          console.error(`Error processing segment ${segmentId}:`, error);
          weatherCell.textContent = "Analysis unavailable";
          weatherCell.style.color = "gray";
        });

      segmentPromises.push(promise);
    }
  });

  // Wait for all segments to be processed
  try {
    await Promise.all(segmentPromises);
    console.log("Strava Plugin: Weather analysis complete for all segments");
  } catch (error) {
    console.error("Error processing segments:", error);
  }
}

/**
 * Update a weather cell with analysis results
 * @param {HTMLElement} cell - The table cell to update
 * @param {Object} analysis - The weather analysis result
 */
function updateWeatherCell(cell, analysis) {
  if (!analysis) {
    cell.textContent = "No data";
    cell.style.color = "gray";
    return;
  }

  cell.textContent = analysis.level;
  cell.title = analysis.message;
  cell.style.fontStyle = "normal";

  // Add tooltip with detailed info
  cell.setAttribute("data-toggle", "tooltip");
  cell.setAttribute("data-placement", "top");

  // Style based on conditions
  if (analysis.level === AssistLevel.FAVORABLE) {
    cell.style.color = "green";
  } else if (analysis.level === AssistLevel.UNFAVORABLE) {
    cell.style.color = "red";
  } else {
    cell.style.color = "orange";
  }
}

/**
 * Process weather data for a segment
 * @param {string} segmentId - The segment ID
 * @returns {Promise<Object>} The weather analysis
 */
async function processSegmentWeather(segmentId) {
  // Check if already processed
  if (segmentWeatherMap.has(segmentId)) {
    return segmentWeatherMap.get(segmentId);
  }

  try {
    // Get segment details including location
    const segment = await getSegmentWithCache(segmentId);

    // If we need to extract coordinates from polyline
    if (!segment.start_latlng && segment.map && segment.map.polyline) {
      const coordinates = decodePolyline(segment.map.polyline);
      if (coordinates.length > 0) {
        segment.start_latlng = coordinates[0];

        // Calculate rough direction if we have start and end points
        if (coordinates.length > 1) {
          segment.end_latlng = coordinates[coordinates.length - 1];

          // Calculate direction (simplified calculation)
          const [startLat, startLng] = coordinates[0];
          const [endLat, endLng] = coordinates[coordinates.length - 1];
          const deltaY = endLng - startLng;
          const deltaX = endLat - startLat;
          segment.direction = (Math.atan2(deltaY, deltaX) * 180) / Math.PI;
        }
      }
    }

    // Get current weather for the segment location
    let weather;
    if (segment.start_latlng) {
      const [lat, lng] = segment.start_latlng;
      weather = await getCurrentWeather(lat, lng);
    } else {
      throw new Error("Segment location data not available");
    }

    // Analyze the weather conditions for this segment
    const analysis = analyzeWeather(weather, segment);

    // Cache the result
    segmentWeatherMap.set(segmentId, analysis);

    return analysis;
  } catch (error) {
    console.error(`Error getting weather for segment ${segmentId}:`, error);
    return null;
  }
}

// Execute when the page is fully loaded
window.addEventListener("load", function () {
  // Wait a short time for any dynamic content to load
  setTimeout(addWeatherAssistColumn, 1000);
});

// Also handle cases where the page might be loaded through AJAX
// This uses a MutationObserver to detect when the table is added to the DOM
const observer = new MutationObserver(function (mutations) {
  mutations.forEach(function (mutation) {
    if (mutation.addedNodes && mutation.addedNodes.length > 0) {
      for (let i = 0; i < mutation.addedNodes.length; i++) {
        const node = mutation.addedNodes[i];
        if (node.classList && node.classList.contains("starred-segments")) {
          addWeatherAssistColumn();
          return;
        }
      }
    }
  });
});

// Start observing the document with the configured parameters
observer.observe(document.body, { childList: true, subtree: true });

// Helper function to decode Google polylines
function decodePolyline(encoded) {
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;
  const coordinates = [];

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coordinates.push([lat * 1e-5, lng * 1e-5]);
  }

  return coordinates;
}

// Export functions for testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    addWeatherAssistColumn,
    processSegmentWeather,
    updateWeatherCell,
  };
}
