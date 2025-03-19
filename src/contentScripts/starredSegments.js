// src/contentScripts/starredSegments.js - Content script for the Strava starred segments page

console.log("Strava Plugin: Content script loaded for starred segments page");

// Function to add the weather assist column
function addWeatherAssistColumn() {
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

  // Add data cells to each row
  const rows = table.querySelectorAll("tbody tr");
  rows.forEach((row) => {
    // Extract segment ID from the row
    const segmentLink = row.querySelector("td:nth-child(3) a");
    let segmentId = "";
    if (segmentLink) {
      const href = segmentLink.getAttribute("href");
      segmentId = href.split("/").pop();
    }

    // Store segment ID as a data attribute for future use
    // This will be used when we integrate the weather API
    const weatherCell = document.createElement("td");
    weatherCell.dataset.segmentId = segmentId;

    // For now, just add sample text
    // Later we'll replace this with actual weather data
    const randomAssist = ["Favorable", "Neutral", "Unfavorable"][
      Math.floor(Math.random() * 3)
    ];
    weatherCell.textContent = randomAssist;

    // Add some styling based on the condition
    if (randomAssist === "Favorable") {
      weatherCell.style.color = "green";
    } else if (randomAssist === "Unfavorable") {
      weatherCell.style.color = "red";
    }

    row.appendChild(weatherCell);
  });
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

// Export functions for testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    addWeatherAssistColumn,
  };
}
