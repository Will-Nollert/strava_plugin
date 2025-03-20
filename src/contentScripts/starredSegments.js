// src/contentScripts/starredSegments.js - Adds functionality to Strava's starred segments page

// Config
const COLUMN_WIDTH = "120px";
const COLUMN_TITLE = "Weather Assist";

// Mutation observer to watch for DOM changes in the page
let observer = null;

/**
 * Initialize the content script functionality
 */
function init() {
  // Add necessary styles
  addStyles();

  // Set up page integration
  setupPageIntegration();

  // Re-check when URL changes (for single-page applications)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setupPageIntegration();
    }
  }).observe(document, { subtree: true, childList: true });
}

/**
 * Set up integration with the starred segments page
 */
function setupPageIntegration() {
  // Check if we're on the right page
  if (!isStarredSegmentsPage()) {
    return;
  }

  console.log("Strava Plugin: Detected starred segments page");

  // Set up an observer to detect when segment tables are loaded
  setupObserver();

  // Process any segment tables that are already loaded
  processExistingTables();
}

/**
 * Check if the current page is the starred segments page
 * @returns {boolean} True if on the starred segments page
 */
function isStarredSegmentsPage() {
  return (
    window.location.pathname.includes("/athlete/segments/starred") ||
    document.querySelector(".starred-segments-header") !== null
  );
}

/**
 * Set up a mutation observer to watch for segment tables being added to the DOM
 */
function setupObserver() {
  // Disconnect any existing observer
  if (observer) {
    observer.disconnect();
  }

  // Create a new mutation observer
  observer = new MutationObserver((mutations) => {
    let shouldProcess = false;

    for (const mutation of mutations) {
      // Look for added nodes that might be segments
      if (mutation.type === "childList" && mutation.addedNodes.length) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (
              node.classList?.contains("segments-table") ||
              node.tagName === "TR" ||
              node.querySelector?.(".segments-table, tr.starred-segment")
            ) {
              shouldProcess = true;
              break;
            }
          }
        }
      }

      // Also check for relevant attribute changes
      if (
        mutation.type === "attributes" &&
        mutation.target.classList?.contains("segments-table")
      ) {
        shouldProcess = true;
      }

      if (shouldProcess) break;
    }

    if (shouldProcess) {
      processExistingTables();
    }
  });

  // Start observing the document
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });
}

/**
 * Process segment tables that are already in the DOM
 */
function processExistingTables() {
  // Find all segment tables
  const tables = document.querySelectorAll(".segments-table");

  if (tables.length === 0) {
    console.log("Strava Plugin: No segment tables found yet");
    return;
  }

  console.log(`Strava Plugin: Found ${tables.length} segment tables`);

  // Process each table
  tables.forEach((table) => {
    // Add our custom column header if not already present
    addWeatherColumnHeader(table);

    // Add a placeholder cell to each row for the weather data
    // The actual weather data will be filled in by starredSegmentsWeather.js
    const rows = table.querySelectorAll("tbody tr.starred-segment");
    rows.forEach((row) => {
      addWeatherPlaceholderCell(row);
    });
  });
}

/**
 * Add the Weather Assist column header to a table
 * @param {HTMLElement} table - The segment table
 */
function addWeatherColumnHeader(table) {
  // Check if the header already exists
  const headerRow = table.querySelector("thead tr");
  if (!headerRow) return;

  if (headerRow.querySelector(".weather-assist-col")) {
    return; // Column already exists
  }

  // Create and add the new header cell
  const weatherHeader = document.createElement("th");
  weatherHeader.className = "weather-assist-col";
  weatherHeader.style.width = COLUMN_WIDTH;
  weatherHeader.textContent = COLUMN_TITLE;

  // Insert before the star column (usually the last column)
  const starHeader = headerRow.querySelector("th:last-child");
  if (starHeader) {
    headerRow.insertBefore(weatherHeader, starHeader);
  } else {
    headerRow.appendChild(weatherHeader);
  }

  console.log("Strava Plugin: Added weather column header");
}

/**
 * Add a placeholder cell for weather data to a segment row
 * @param {HTMLElement} row - The segment row
 */
function addWeatherPlaceholderCell(row) {
  // Check if the cell already exists
  if (row.querySelector(".weather-assist-cell")) {
    return; // Cell already exists
  }

  // Create the weather cell
  const weatherCell = document.createElement("td");
  weatherCell.className = "weather-assist-cell";
  weatherCell.innerHTML = "<div class=\"weather-placeholder\">--</div>";

  // Insert before the star cell (usually the last cell)
  const starCell = row.querySelector("td:last-child");
  if (starCell) {
    row.insertBefore(weatherCell, starCell);
  } else {
    row.appendChild(weatherCell);
  }
}

/**
 * Add CSS styles for the weather column
 */
function addStyles() {
  const styleElement = document.createElement("style");
  styleElement.textContent = `
    .weather-assist-cell {
      vertical-align: middle;
      padding: 8px;
    }
    
    .weather-placeholder {
      color: #999;
      text-align: center;
      font-size: 14px;
    }
  `;

  document.head.appendChild(styleElement);
}

// Start the content script
init();
