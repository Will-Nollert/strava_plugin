// src/settings.js - Settings page logic
import {
  getSettings,
  saveSettings,
  resetSettings,
} from "./services/settingsService.js";
//import CONFIG from "./config.js";

// DOM elements
let useCacheToggle;
let inMemoryCachingToggle;
let weatherCacheDurationSlider;
let weatherCacheDurationDisplay;
let segmentCacheDurationSlider;
let segmentCacheDurationDisplay;
let resetButton;
let saveButton;
let statusMessage;
let versionElement;

// Format duration in seconds to a human-readable string
function formatDuration(seconds) {
  if (seconds < 60) {
    return `${seconds} seconds`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  } else {
    const days = Math.floor(seconds / 86400);
    return `${days} ${days === 1 ? "day" : "days"}`;
  }
}

// Update slider display values
function updateSliderDisplays() {
  weatherCacheDurationDisplay.textContent = formatDuration(
    parseInt(weatherCacheDurationSlider.value)
  );

  segmentCacheDurationDisplay.textContent = formatDuration(
    parseInt(segmentCacheDurationSlider.value)
  );
}

// Show status message
function showStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.className = "status-message";

  if (isError) {
    statusMessage.classList.add("error");
  } else {
    statusMessage.classList.add("success");
  }

  // Hide after 3 seconds
  setTimeout(() => {
    statusMessage.className = "status-message";
  }, 3000);
}

// Load settings into form
async function loadSettings() {
  try {
    const settings = await getSettings();

    // Update toggle switches
    useCacheToggle.checked = settings.useCache;
    inMemoryCachingToggle.checked = settings.inMemoryCaching;

    // Update sliders
    weatherCacheDurationSlider.value = settings.weatherCacheDuration;
    segmentCacheDurationSlider.value = settings.segmentCacheDuration;

    // Update slider displays
    updateSliderDisplays();
  } catch (error) {
    console.error("Error loading settings:", error);
    showStatus("Failed to load settings", true);
  }
}

// Save settings from form
async function handleSaveSettings() {
  try {
    const settings = {
      useCache: useCacheToggle.checked,
      inMemoryCaching: inMemoryCachingToggle.checked,
      weatherCacheDuration: parseInt(weatherCacheDurationSlider.value),
      segmentCacheDuration: parseInt(segmentCacheDurationSlider.value),
    };

    await saveSettings(settings);
    showStatus("Settings saved successfully");
  } catch (error) {
    console.error("Error saving settings:", error);
    showStatus("Failed to save settings", true);
  }
}

// Reset settings to defaults
async function handleResetSettings() {
  try {
    await resetSettings();
    await loadSettings(); // Reload form with default values
    showStatus("Settings reset to defaults");
  } catch (error) {
    console.error("Error resetting settings:", error);
    showStatus("Failed to reset settings", true);
  }
}

// Initialize the page
document.addEventListener("DOMContentLoaded", async function () {
  console.log("Strava Plugin Settings Loaded");

  // Set version
  versionElement = document.getElementById("version");
  versionElement.textContent = `Version: ${
    chrome.runtime.getManifest().version
  }`;

  // Get DOM elements
  useCacheToggle = document.getElementById("useCache");
  inMemoryCachingToggle = document.getElementById("inMemoryCaching");
  weatherCacheDurationSlider = document.getElementById("weatherCacheDuration");
  weatherCacheDurationDisplay = document.getElementById(
    "weatherCacheDurationDisplay"
  );
  segmentCacheDurationSlider = document.getElementById("segmentCacheDuration");
  segmentCacheDurationDisplay = document.getElementById(
    "segmentCacheDurationDisplay"
  );
  resetButton = document.getElementById("resetButton");
  saveButton = document.getElementById("saveButton");
  statusMessage = document.getElementById("statusMessage");

  // Set up event listeners
  weatherCacheDurationSlider.addEventListener("input", updateSliderDisplays);
  segmentCacheDurationSlider.addEventListener("input", updateSliderDisplays);
  resetButton.addEventListener("click", handleResetSettings);
  saveButton.addEventListener("click", handleSaveSettings);

  // Load initial settings
  await loadSettings();
});
