// src/contentScripts/starredSegmentsWeather.js - Injects weather data into Strava's UI

// Config
//const API_RETRY_DELAY = 1000;
//const MAX_API_RETRIES = 3;
const WEATHER_CACHE_PREFIX = "segment_weather_";
// Cache expiration (48 hours in milliseconds)
const CACHE_EXPIRATION = 48 * 60 * 60 * 1000;

// Store of segment weather data to avoid redundant API calls
const segmentWeatherCache = new Map();

/**
 * Initialize the weather integration in the starred segments page
 */
async function initWeatherIntegration() {
  try {
    // Check if the user is authenticated with Strava
    const isAuthenticated = await checkAuthentication();
    if (!isAuthenticated) {
      console.log(
        "User not authenticated with Strava. Weather data integration disabled."
      );
      return;
    }

    // Observe DOM changes to detect when segment tables are loaded or updated
    setupObserver();

    // Check if we're already on the page with segments loaded
    processExistingSegments();
  } catch (error) {
    console.error("Error initializing weather integration:", error);
  }
}

/**
 * Check if the user is authenticated with Strava
 * @returns {Promise<boolean>} True if authenticated
 */
function checkAuthentication() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "AUTH_CHECK" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error checking authentication:",
          chrome.runtime.lastError
        );
        resolve(false);
        return;
      }

      resolve(response && response.isAuthenticated === true);
    });
  });
}

/**
 * Set up a mutation observer to detect when segment tables are loaded or updated
 */
function setupObserver() {
  // Create a new observer
  const observer = new MutationObserver((mutations) => {
    // For any DOM changes, check if we need to process segments
    const shouldProcess = mutations.some((mutation) => {
      // Look for table mutations that might be segment tables
      if (
        mutation.type === "childList" &&
        (mutation.target.classList?.contains("segments-table") ||
          mutation.target.tagName === "TABLE" ||
          mutation.target.tagName === "TBODY")
      ) {
        return true;
      }

      // Check for added nodes that might be segments
      if (mutation.type === "childList" && mutation.addedNodes.length) {
        return Array.from(mutation.addedNodes).some(
          (node) =>
            node.classList?.contains("segments-table") ||
            node.tagName === "TR" ||
            node.querySelector?.(".segments-table, tr.starred-segment")
        );
      }

      return false;
    });

    if (shouldProcess) {
      processExistingSegments();
    }
  });

  // Start observing the document with the configured parameters
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });
}

/**
 * Process any existing segment tables already in the DOM
 */
function processExistingSegments() {
  // Check if we're on the starred segments page
  if (!isStarredSegmentsPage()) {
    return;
  }

  // Find all segment tables
  const segmentTables = document.querySelectorAll(".segments-table");
  if (segmentTables.length === 0) {
    console.log("No segment tables found yet.");
    return;
  }

  // Process all segment rows in each table
  segmentTables.forEach((table) => {
    const segmentRows = table.querySelectorAll("tbody tr.starred-segment");
    segmentRows.forEach((row) => {
      processSegmentRow(row);
    });
  });
}

/**
 * Check if the current page is the starred segments page
 * @returns {boolean} True if on the starred segments page
 */
function isStarredSegmentsPage() {
  // URL pattern for starred segments
  return (
    window.location.pathname.includes("/athlete/segments/starred") ||
    document.querySelector(".starred-segments-header") !== null
  );
}

/**
 * Process a segment row to add weather data
 * @param {HTMLElement} row - The segment row element
 */
async function processSegmentRow(row) {
  // Find the weather cell (should have been added by starredSegments.js)
  const weatherCell = row.querySelector(".weather-assist-cell");
  if (!weatherCell) {
    console.log("Weather cell not found in row, skipping");
    return;
  }

  // Check if we've already processed this cell with actual weather data
  if (weatherCell.querySelector(".weather-container")) {
    return; // Already processed with actual weather data
  }

  // Update cell to show loading
  weatherCell.innerHTML = "<div class=\"weather-loading\">Loading...</div>";

  // Extract segment ID from the row
  const segmentId = extractSegmentId(row);
  if (!segmentId) {
    weatherCell.innerHTML =
      "<div class=\"weather-error\">Error: No segment ID</div>";
    return;
  }

  // Check in-memory cache first
  if (segmentWeatherCache.has(segmentId)) {
    updateWeatherCell(weatherCell, segmentWeatherCache.get(segmentId));
    return;
  }

  // Check Chrome storage cache
  const cachedWeather = await retrieveWeatherFromCache(segmentId);
  if (cachedWeather) {
    // Update in-memory cache too
    segmentWeatherCache.set(segmentId, cachedWeather);
    updateWeatherCell(weatherCell, cachedWeather);
    return;
  }

  try {
    // Fetch segment details
    const segmentData = await fetchSegmentDetails(segmentId);
    if (!segmentData) {
      weatherCell.innerHTML =
        "<div class=\"weather-error\">Error retrieving segment data</div>";
      return;
    }

    // Get the latest effort
    const effort = await fetchLatestEffort(segmentId);
    if (!effort) {
      weatherCell.innerHTML =
        "<div class=\"weather-info\">No efforts found</div>";
      return;
    }

    // Convert effort start_date to timestamp
    const effortTimestamp = Math.floor(
      new Date(effort.start_date).getTime() / 1000
    );

    // Get weather impact for this effort
    const weatherImpact = await fetchWeatherForSegment(
      segmentData,
      effortTimestamp
    );

    // Cache the result in memory
    segmentWeatherCache.set(segmentId, weatherImpact);

    // Store in chrome storage for persistence
    storeWeatherInCache(segmentId, weatherImpact);

    // Update the cell with the weather data
    updateWeatherCell(weatherCell, weatherImpact);
  } catch (error) {
    console.error(`Error processing segment ${segmentId}:`, error);
    weatherCell.innerHTML =
      "<div class=\"weather-error\">Error retrieving weather data</div>";
  }
}

/**
 * Extract the segment ID from a segment row
 * @param {HTMLElement} row - The segment row element
 * @returns {string|null} The segment ID or null if not found
 */
function extractSegmentId(row) {
  // Look for the segment link
  const segmentLink = row.querySelector("a.segment-link");
  if (!segmentLink) return null;

  // Extract ID from the link href
  const href = segmentLink.getAttribute("href");
  if (!href) return null;

  // Pattern: /segments/12345
  const match = href.match(/\/segments\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Fetch segment details using the background script
 * @param {string} segmentId - The segment ID
 * @returns {Promise<Object|null>} Segment details or null if failed
 */
async function fetchSegmentDetails(segmentId) {
  try {
    // Send a message to the background script to fetch the data
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: "GET_SEGMENT_DETAILS",
          segmentId: segmentId,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }

          if (response && response.error) {
            reject(new Error(response.error));
            return;
          }

          resolve(response && response.success ? response.data : null);
        }
      );
    });
  } catch (error) {
    console.error(`Error fetching segment details for ${segmentId}:`, error);
    return null;
  }
}

/**
 * Fetch the latest effort for a segment
 * @param {string} segmentId - The segment ID
 * @returns {Promise<Object|null>} The latest effort or null if none
 */
async function fetchLatestEffort(segmentId) {
  try {
    // Send a message to the background script to fetch the data
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: "GET_SEGMENT_EFFORTS",
          segmentId: segmentId,
          limit: 1,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }

          if (response && response.error) {
            reject(new Error(response.error));
            return;
          }

          if (
            response &&
            response.success &&
            response.data &&
            response.data.length > 0
          ) {
            resolve(response.data[0]);
          } else {
            resolve(null);
          }
        }
      );
    });
  } catch (error) {
    console.error(`Error fetching efforts for segment ${segmentId}:`, error);
    return null;
  }
}

/**
 * Fetch weather data for a segment at a specific time
 * @param {Object} segment - The segment details
 * @param {number} timestamp - Unix timestamp (in seconds)
 * @returns {Promise<Object|null>} Weather impact data or null if failed
 */
async function fetchWeatherForSegment(segment, timestamp) {
  try {
    // Send a message to the background script to fetch weather impact
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: "GET_WEATHER_IMPACT",
          segment: segment,
          timestamp: timestamp,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }

          if (response && response.error) {
            reject(new Error(response.error));
            return;
          }

          resolve(response && response.success ? response.data : null);
        }
      );
    });
  } catch (error) {
    console.error(`Error fetching weather for segment ${segment.id}:`, error);
    return null;
  }
}

/**
 * Store weather data in Chrome storage for persistence
 * @param {string} segmentId - The segment ID
 * @param {Object} weatherData - The weather data to store
 */
function storeWeatherInCache(segmentId, weatherData) {
  const key = `${WEATHER_CACHE_PREFIX}${segmentId}`;
  const data = {
    weather: weatherData,
    timestamp: Date.now(),
  };

  chrome.storage.local.set({ [key]: data }, () => {
    if (chrome.runtime.lastError) {
      console.error("Error storing weather data:", chrome.runtime.lastError);
    }
  });
}

/**
 * Retrieve cached weather data from Chrome storage
 * @param {string} segmentId - The segment ID
 * @returns {Promise<Object|null>} Cached weather data or null if not found/expired
 */
function retrieveWeatherFromCache(segmentId) {
  return new Promise((resolve) => {
    const key = `${WEATHER_CACHE_PREFIX}${segmentId}`;

    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError || !result[key]) {
        resolve(null);
        return;
      }

      const data = result[key];

      // Check if cache is expired
      if (Date.now() - data.timestamp > CACHE_EXPIRATION) {
        // Remove expired cache
        chrome.storage.local.remove([key]);
        resolve(null);
        return;
      }

      resolve(data.weather);
    });
  });
}

/**
 * Update a weather cell with weather impact data
 * @param {HTMLElement} cell - The weather cell element
 * @param {Object} weatherImpact - The weather impact data
 */
function updateWeatherCell(cell, weatherImpact) {
  // Handle error or null case
  if (!weatherImpact) {
    cell.innerHTML = "<div class=\"weather-error\">No weather data</div>";
    return;
  }

  // Create rating element with color coding
  const ratingClass =
    weatherImpact.rating >= 80
      ? "excellent"
      : weatherImpact.rating >= 60
        ? "good"
        : weatherImpact.rating >= 40
          ? "fair"
          : "poor";

  // Create HTML for the weather cell
  cell.innerHTML = `
    <div class="weather-container">
      <div class="weather-rating ${ratingClass}">
        <span class="rating-value">${weatherImpact.rating}</span>
      </div>
      <div class="weather-details">
        <div class="weather-impact">
          ${getImpactText(weatherImpact.estimatedTimeImpact)}
        </div>
        <div class="weather-conditions">
          ${getConditionsIcon(weatherImpact.conditions)}
          ${weatherImpact.weather.temp.toFixed(1)}°C
        </div>
      </div>
    </div>
  `;

  // Add hover tooltip with more details
  const tooltipContent = `
    <div class="weather-tooltip-title">Weather Impact Analysis</div>
    <div class="weather-tooltip-rating">Rating: ${
  weatherImpact.rating
}/100</div>
    <div class="weather-tooltip-temp">Temperature: ${weatherImpact.weather.temp.toFixed(
    1
  )}°C (${weatherImpact.conditions.temperature})</div>
    <div class="weather-tooltip-wind">Wind: ${(
    weatherImpact.weather.wind_speed * 3.6
  ).toFixed(1)} km/h (${weatherImpact.conditions.wind})</div>
    <div class="weather-tooltip-impact">Estimated time impact: ${
  weatherImpact.estimatedTimeImpact > 0 ? "+" : ""
}${weatherImpact.estimatedTimeImpact.toFixed(1)}%</div>
    <div class="weather-tooltip-date">Data from: ${new Date(
    weatherImpact.timestamp * 1000
  ).toLocaleDateString()}</div>
  `;

  const tooltip = document.createElement("div");
  tooltip.className = "weather-tooltip";
  tooltip.innerHTML = tooltipContent;
  cell.appendChild(tooltip);

  // Add hover event to show/hide tooltip
  cell.addEventListener("mouseenter", () => {
    tooltip.style.display = "block";
  });

  cell.addEventListener("mouseleave", () => {
    tooltip.style.display = "none";
  });
}

/**
 * Get text description of weather impact
 * @param {number} impact - The estimated time impact percentage
 * @returns {string} Formatted impact text
 */
function getImpactText(impact) {
  if (Math.abs(impact) < 1) {
    return "<span class=\"impact-neutral\">Neutral</span>";
  } else if (impact > 0) {
    return `<span class="impact-negative">+${impact.toFixed(1)}%</span>`;
  } else {
    return `<span class="impact-positive">${impact.toFixed(1)}%</span>`;
  }
}

/**
 * Get weather condition icon HTML
 * @param {Object} conditions - Weather conditions object
 * @returns {string} HTML for the icon
 */
function getConditionsIcon(conditions) {
  // Simple icon mapping based on conditions
  let icon = "🌤️"; // Default: Partly cloudy

  if (conditions.wind.includes("Gale") || conditions.wind.includes("Storm")) {
    icon = "🌬️"; // Windy
  } else if (conditions.temperature.includes("Hot")) {
    icon = "☀️"; // Hot
  } else if (
    conditions.temperature.includes("Cold") ||
    conditions.temperature.includes("Freezing")
  ) {
    icon = "❄️"; // Cold
  } else if (conditions.humidity === "Very Humid") {
    icon = "💧"; // Humid
  }

  return `<span class="weather-icon">${icon}</span>`;
}

/**
 * Add required CSS styles for the weather integration
 */
function addWeatherStyles() {
  const styleElement = document.createElement("style");
  styleElement.textContent = `
    .weather-loading {
      font-style: italic;
      color: #999;
      font-size: 12px;
    }
    
    .weather-error {
      color: #d9534f;
      font-size: 12px;
    }
    
    .weather-info {
      color: #5bc0de;
      font-size: 12px;
    }
    
    .weather-container {
      display: flex;
      align-items: center;
      font-size: 13px;
    }
    
    .weather-rating {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      margin-right: 8px;
      color: white;
      font-weight: bold;
      font-size: 12px;
    }
    
    .weather-rating.excellent {
      background-color: #5cb85c;
    }
    
    .weather-rating.good {
      background-color: #5bc0de;
    }
    
    .weather-rating.fair {
      background-color: #f0ad4e;
    }
    
    .weather-rating.poor {
      background-color: #d9534f;
    }
    
    .weather-details {
      display: flex;
      flex-direction: column;
    }
    
    .weather-impact {
      font-weight: bold;
      margin-bottom: 2px;
    }
    
    .impact-positive {
      color: #5cb85c;
    }
    
    .impact-negative {
      color: #d9534f;
    }
    
    .impact-neutral {
      color: #777;
    }
    
    .weather-conditions {
      display: flex;
      align-items: center;
      color: #777;
    }
    
    .weather-icon {
      margin-right: 4px;
    }
    
    /* Tooltip styles */
    .weather-tooltip {
      display: none;
      position: absolute;
      background: white;
      border: 1px solid #ddd;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      padding: 10px;
      border-radius: 4px;
      z-index: 1000;
      width: 220px;
      top: -5px;
      left: 105%;
      font-size: 12px;
    }
    
    .weather-tooltip-title {
      font-weight: bold;
      margin-bottom: 5px;
      color: #fc4c02;
    }
    
    .weather-tooltip-rating,
    .weather-tooltip-temp,
    .weather-tooltip-wind,
    .weather-tooltip-impact {
      margin-bottom: 3px;
    }
    
    .weather-tooltip-date {
      margin-top: 5px;
      font-style: italic;
      font-size: 11px;
      color: #999;
    }
  `;

  document.head.appendChild(styleElement);
}

// Initialize everything
function init() {
  // Add styles first
  addWeatherStyles();

  // Initialize the weather integration
  initWeatherIntegration();
}

// Start the script
init();
