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
 * Inject custom styles for our UI elements
 */
function injectCustomStyles() {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .weather-assist-link {
      cursor: pointer;
      transition: opacity 0.2s;
    }
    
    .weather-assist-link:hover {
      opacity: 0.8;
      text-decoration: underline !important;
    }
    
    .weather-popover {
      font-family: Arial, sans-serif;
      font-size: 13px;
      line-height: 1.4;
      animation: fadeIn 0.2s ease-out;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-5px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(styleElement);
}

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

  // Check if we already added the column to avoid duplicates
  if (table.querySelector('th[data-plugin-column="weather-assist"]')) {
    console.log("Strava Plugin: Weather assist column already added");
    return;
  }

  // Add header column
  const headerRow = table.querySelector("thead tr");
  if (headerRow) {
    const weatherHeader = document.createElement("th");
    weatherHeader.textContent = "Weather Assist";
    weatherHeader.dataset.pluginColumn = "weather-assist";
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

  // Create a link instead of just text
  const link = document.createElement("a");
  link.textContent = analysis.level;
  link.href = "#";
  link.style.textDecoration = "none";
  link.style.fontStyle = "normal";
  link.className = "weather-assist-link";

  // Style based on conditions
  if (analysis.level === AssistLevel.FAVORABLE) {
    link.style.color = "green";
  } else if (analysis.level === AssistLevel.UNFAVORABLE) {
    link.style.color = "red";
  } else {
    link.style.color = "orange";
  }

  // Clear cell and add the link
  cell.textContent = "";
  cell.appendChild(link);

  // Add click handler to show popover
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showWeatherPopover(event.target, analysis);
  });
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

/**
 * Show a popover with detailed weather information
 * @param {HTMLElement} element - The element that was clicked
 * @param {Object} analysis - The weather analysis result
 */
function showWeatherPopover(element, analysis) {
  // Remove any existing popovers
  removeExistingPopovers();

  // Create popover container
  const popover = document.createElement("div");
  popover.className = "weather-popover";
  popover.style.position = "absolute";
  popover.style.zIndex = "1000";
  popover.style.backgroundColor = "white";
  popover.style.border = "1px solid #ccc";
  popover.style.borderRadius = "4px";
  popover.style.padding = "10px";
  popover.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
  popover.style.maxWidth = "300px";

  // Get position of the clicked element
  const rect = element.getBoundingClientRect();
  popover.style.top = `${rect.bottom + window.scrollY + 5}px`;
  popover.style.left = `${rect.left + window.scrollX}px`;

  // Build popover content
  let headingColor;
  if (analysis.level === AssistLevel.FAVORABLE) {
    headingColor = "green";
  } else if (analysis.level === AssistLevel.UNFAVORABLE) {
    headingColor = "red";
  } else {
    headingColor = "orange";
  }

  // Add directional analysis visualization if available
  let directionalAnalysisHTML = '';
  if (analysis.directionalAnalysis && analysis.directionalAnalysis.weighted) {
    const da = analysis.directionalAnalysis;

    // Create a simple rose diagram visualization
    directionalAnalysisHTML = `
      <hr style="margin: 8px 0; border: none; border-top: 1px solid #eee;">
      <h4 style="margin: 8px 0 5px;">Segment Direction Analysis:</h4>
      <div style="position: relative; width: 120px; height: 120px; margin: 10px auto;">
        ${createDirectionRose(da.distribution)}
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 12px; background: rgba(255,255,255,0.7); padding: 2px 5px; border-radius: 3px;">
          ${da.dominantCardinal} ${da.dominantPercentage.toFixed(0)}%
        </div>
      </div>
      <div style="font-size: 11px; text-align: center; margin-bottom: 8px;">
        Direction distribution (% of segment length)
      </div>
    `;
  }

  // Access wind information safely
  const windFactor = analysis.factors.wind;
  const windSpeed = analysis.weatherData?.windSpeed || 0;

  // Determine wind context based on factor and speed
  let windContext = "Unknown wind conditions";
  if (windSpeed < 1) {
    windContext = "Light wind";
  } else if (Math.abs(windFactor) > 0.7) {
    windContext = windFactor > 0 ? "Strong tailwind" : "Strong headwind";
  } else if (Math.abs(windFactor) > 0.3) {
    windContext = windFactor > 0 ? "Tailwind" : "Headwind";
  } else {
    windContext = "Crosswind";
  }

  // Wind icon based on factor
  let windIcon, windText;
  if (windFactor > 0.3) {
    windIcon = "👍"; // thumbs up
    windText = "Favorable";
  } else if (windFactor < -0.3) {
    windIcon = "👎"; // thumbs down
    windText = "Unfavorable";
  } else {
    windIcon = "➖"; // neutral
    windText = "Neutral";
  }

  popover.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <h3 style="margin: 0; color: ${headingColor};">${analysis.level} Conditions</h3>
      <button class="close-popover" style="border: none; background: none; cursor: pointer; font-size: 16px;">×</button>
    </div>
    <p style="margin: 5px 0;"><strong>Summary:</strong> ${analysis.message}</p>
    <hr style="margin: 8px 0; border: none; border-top: 1px solid #eee;">
    <h4 style="margin: 8px 0 5px;">Factors:</h4>
    <ul style="margin: 0; padding-left: 20px;">
      <li>Wind: ${windIcon} ${windText} (${windFactor.toFixed(2)}) - ${windContext} ${windSpeed.toFixed(1)} m/s</li>
      <li>Temperature: ${formatFactor(analysis.factors.temperature)}</li>
      <li>Precipitation: ${formatFactor(analysis.factors.precipitation)}</li>
      <li>Humidity: ${formatFactor(analysis.factors.humidity)}</li>
    </ul>
    <p style="margin: 8px 0 0;"><strong>Overall score:</strong> ${analysis.score.toFixed(2)}</p>
    ${directionalAnalysisHTML}
    <hr style="margin: 8px 0; border: none; border-top: 1px solid #eee;">
    <h4 style="margin: 8px 0 5px;">Current Weather:</h4>
    <ul style="margin: 0; padding-left: 20px;">
      <li>Temperature: ${analysis.weatherData?.temperature}°C</li>
      <li>Wind: ${analysis.weatherData?.windSpeed} m/s${analysis.weatherData?.windGust ? ` (gusts up to ${analysis.weatherData.windGust} m/s)` : ''}</li>
      <li>Humidity: ${analysis.weatherData?.humidity}%</li>
      <li>Precipitation: ${analysis.weatherData?.precipitation} mm</li>
      <li>Conditions: ${analysis.weatherData?.conditions}</li>
    </ul>
  `;

  // Add close handler to X button
  document.body.appendChild(popover);
  popover.querySelector(".close-popover").addEventListener("click", removeExistingPopovers);

  // Close when clicking outside
  document.addEventListener("click", closePopoverOnOutsideClick);
}

/**
 * Format a factor value to a readable string with icon
 * @param {number} value - Factor value (-1 to 1)
 * @returns {string} Formatted string with icon
 */
function formatFactor(value) {
  let icon, text;

  if (value > 0.3) {
    icon = "👍"; // thumbs up
    text = "Favorable";
  } else if (value < -0.3) {
    icon = "👎"; // thumbs down
    text = "Unfavorable";
  } else {
    icon = "➖"; // neutral
    text = "Neutral";
  }

  return `${icon} ${text} (${value.toFixed(2)})`;
}

/**
 * Creates a simple SVG direction rose visualization
 * @param {Object} distribution - Direction distribution percentages
 * @returns {string} SVG HTML
 */
function createDirectionRose(distribution) {
  const center = 60;
  const maxRadius = 50;

  // Create paths for each direction
  let paths = '';
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  directions.forEach((dir, index) => {
    const percentage = distribution[dir] || 0;
    const radius = (percentage / 100) * maxRadius;
    if (radius <= 0) return;

    const angle = index * 45;
    const startAngle = angle - 22.5;
    const endAngle = angle + 22.5;

    // Calculate points
    const x1 = center + radius * Math.sin(startAngle * Math.PI / 180);
    const y1 = center - radius * Math.cos(startAngle * Math.PI / 180);
    const x2 = center + radius * Math.sin(endAngle * Math.PI / 180);
    const y2 = center - radius * Math.cos(endAngle * Math.PI / 180);

    // Create path
    const path = `
      <path 
        d="M ${center},${center} L ${x1},${y1} A ${radius},${radius} 0 0,1 ${x2},${y2} Z" 
        fill="rgba(76, 175, 80, 0.7)" 
        stroke="#333" 
        stroke-width="0.5"
        title="${dir}: ${percentage}%"
      />
    `;

    paths += path;
  });

  // Create SVG
  return `
    <svg width="120" height="120" viewBox="0 0 120 120">
      <!-- Guide circles -->
      <circle cx="${center}" cy="${center}" r="${maxRadius * 0.33}" fill="none" stroke="#ccc" stroke-width="0.5" />
      <circle cx="${center}" cy="${center}" r="${maxRadius * 0.66}" fill="none" stroke="#ccc" stroke-width="0.5" />
      <circle cx="${center}" cy="${center}" r="${maxRadius}" fill="none" stroke="#ccc" stroke-width="0.5" />
      
      <!-- Direction labels -->
      <text x="${center}" y="${center - maxRadius - 5}" text-anchor="middle" font-size="10" fill="#666">N</text>
      <text x="${center + maxRadius + 5}" y="${center}" text-anchor="start" font-size="10" fill="#666">E</text>
      <text x="${center}" y="${center + maxRadius + 10}" text-anchor="middle" font-size="10" fill="#666">S</text>
      <text x="${center - maxRadius - 5}" y="${center}" text-anchor="end" font-size="10" fill="#666">W</text>
      
      <!-- Direction wedges -->
      ${paths}
      
      <!-- Wind direction indicator -->
      <circle cx="${center}" cy="${center}" r="2" fill="#333" />
    </svg>
  `;
}

/**
 * Format a wind factor value with additional context
 * @param {number} value - Wind factor value (-1 to 1)
 * @param {number} windSpeed - Wind speed in m/s
 * @param {number} windDeg - Wind direction in degrees
 * @param {Object} segmentAnalysis - Segment directional analysis (optional)
 * @returns {string} Formatted string with context
 */
function formatWindFactor(value, windSpeed, windDeg, segmentAnalysis) {
  let icon, text;

  if (value > 0.3) {
    icon = "👍"; // thumbs up
    text = "Favorable";
  } else if (value < -0.3) {
    icon = "👎"; // thumbs down
    text = "Unfavorable";
  } else {
    icon = "➖"; // neutral
    text = "Neutral";
  }

  // Add wind context based on the value
  let windContext = "";
  if (windSpeed < 1) {
    windContext = "Light wind";
  } else if (Math.abs(value) > 0.7) {
    windContext = value > 0 ? "Strong tailwind" : "Strong headwind";
  } else if (Math.abs(value) > 0.3) {
    windContext = value > 0 ? "Tailwind" : "Headwind";
  } else {
    windContext = "Crosswind";
  }

  return `${icon} ${text} (${value.toFixed(2)}) - ${windContext} ${windSpeed.toFixed(1)} m/s`;
}

/**
 * Remove any existing popovers
 */
function removeExistingPopovers() {
  const existingPopovers = document.querySelectorAll(".weather-popover");
  existingPopovers.forEach(popover => {
    popover.remove();
  });

  // Remove the outside click handler
  document.removeEventListener("click", closePopoverOnOutsideClick);
}

/**
 * Close popover when clicking outside
 * @param {Event} event - Click event
 */
function closePopoverOnOutsideClick(event) {
  const popover = document.querySelector(".weather-popover");
  if (popover && !popover.contains(event.target) && !event.target.classList.contains("weather-assist-link")) {
    removeExistingPopovers();
  }
}

// Initialize the content script
function initialize() {
  // Inject our custom styles
  injectCustomStyles();

  // Wait a short time for any dynamic content to load
  setTimeout(addWeatherAssistColumn, 1000);
}

// Execute when the page is fully loaded
window.addEventListener("load", initialize);

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