// src/contentScripts/starredSegments.js
console.log("Strava Plugin: Content script loaded for starred segments page");

// Map to store weather data and analysis for segments
const segmentWeatherMap = new Map();

// Constants for weather analysis levels
const AssistLevel = {
  FAVORABLE: "Favorable",
  NEUTRAL: "Neutral",
  UNFAVORABLE: "Unfavorable",
};

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
 * Process weather data for a segment via background script
 * @param {string} segmentId - The segment ID
 * @returns {Promise<Object>} The weather analysis
 */
async function processSegmentWeather(segmentId) {
  // Check if already processed
  if (segmentWeatherMap.has(segmentId)) {
    return segmentWeatherMap.get(segmentId);
  }

  try {
    // Use message passing to get weather analysis from background script
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: "GET_SEGMENT_WEATHER",
          segmentId: segmentId
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Error sending message:", chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }

          if (!response || !response.success) {
            const error = response?.error || "Unknown error";
            console.error(`Error getting segment weather: ${error}`);
            reject(new Error(error));
            return;
          }

          // Cache the result locally
          segmentWeatherMap.set(segmentId, response.analysis);
          resolve(response.analysis);
        }
      );
    });
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