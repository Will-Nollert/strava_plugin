// src/popup.js - Main popup script for the Strava Plugin
import { authenticate, getAuthData, logout } from "./auth.js";
import {
  getAthleteProfile,
  getStarredSegments,
  getSegmentPolyline,
  convertToGPX,
} from "./api.js";

// Store the current state
const state = {
  isAuthenticated: false,
  athlete: null,
  segments: [],
  selectedSegmentId: null,
  isLoading: false,
  error: null,
};

// DOM elements
let authStatus;
let loginButton;
let logoutButton;
let profileSection;
let profileImage;
let profileName;
let profileDetails;
let segmentsSection;
let segmentsLoading;
let segmentsError;
let segmentsList;
let refreshButton;
let downloadGpxButton;
let versionElement;

// Initialize the popup
document.addEventListener("DOMContentLoaded", async function () {
  console.log("Strava Plugin Loaded");

  // Set version
  versionElement = document.getElementById("version");
  versionElement.textContent = `Version: ${
    chrome.runtime.getManifest().version
  }`;

  // Get DOM elements
  authStatus = document.getElementById("auth-status");
  loginButton = document.getElementById("login-button");
  logoutButton = document.getElementById("logout-button");
  profileSection = document.getElementById("profile-section");
  profileImage = document.getElementById("profile-image");
  profileName = document.getElementById("profile-name");
  profileDetails = document.getElementById("profile-details");
  segmentsSection = document.getElementById("segments-section");
  segmentsLoading = document.getElementById("segments-loading");
  segmentsError = document.getElementById("segments-error");
  segmentsList = document.getElementById("segments-list");
  refreshButton = document.getElementById("refresh-button");
  downloadGpxButton = document.getElementById("download-gpx");

  // Set up event listeners
  loginButton.addEventListener("click", handleLogin);
  logoutButton.addEventListener("click", handleLogout);
  refreshButton.addEventListener("click", loadStarredSegments);
  downloadGpxButton.addEventListener("click", downloadSelectedSegmentAsGPX);

  // Check authentication status on load
  try {
    const authData = await getAuthData();
    if (authData && authData.access_token) {
      state.isAuthenticated = true;
      updateAuthUI();
      await loadUserProfile();
      await loadStarredSegments();
    } else {
      updateAuthUI();
    }
  } catch (error) {
    handleError(error);
    updateAuthUI();
  }
});

// Handle login button click
async function handleLogin() {
  setLoading(true);
  try {
    await authenticate();
    state.isAuthenticated = true;
    updateAuthUI();
    await loadUserProfile();
    await loadStarredSegments();
  } catch (error) {
    handleError(error);
  } finally {
    setLoading(false);
  }
}

// Handle logout button click
async function handleLogout() {
  setLoading(true);
  try {
    await logout();
    state.isAuthenticated = false;
    state.athlete = null;
    state.segments = [];
    state.selectedSegmentId = null;
    updateAuthUI();
  } catch (error) {
    handleError(error);
  } finally {
    setLoading(false);
  }
}

// Load user profile data
async function loadUserProfile() {
  if (!state.isAuthenticated) return;

  setLoading(true);
  try {
    const profile = await getAthleteProfile();
    state.athlete = profile;

    // Update UI
    profileName.textContent = `${profile.firstname} ${profile.lastname}`;
    profileDetails.textContent = `${profile.city}, ${profile.country}`;

    // Set profile image if available
    if (profile.profile) {
      profileImage.src = profile.profile;
    }

    profileSection.style.display = "block";
  } catch (error) {
    handleError(error);
  } finally {
    setLoading(false);
  }
}

// Load starred segments
async function loadStarredSegments() {
  if (!state.isAuthenticated) return;

  setLoading(true);
  segmentsLoading.style.display = "block";
  segmentsList.innerHTML = "";
  segmentsError.style.display = "none";

  try {
    const segments = await getStarredSegments();
    state.segments = segments;

    // Update UI
    renderSegmentsList();
    segmentsSection.style.display = "block";
  } catch (error) {
    handleError(error);
  } finally {
    setLoading(false);
    segmentsLoading.style.display = "none";
  }
}

// Render the segments list
function renderSegmentsList() {
  segmentsList.innerHTML = "";

  if (state.segments.length === 0) {
    segmentsList.innerHTML = "<p>No starred segments found.</p>";
    return;
  }

  state.segments.forEach((segment) => {
    const segmentItem = document.createElement("div");
    segmentItem.classList.add("segment-item");
    if (segment.id === state.selectedSegmentId) {
      segmentItem.style.backgroundColor = "#f0f0f0";
      segmentItem.style.borderColor = "#FC4C02";
    }

    segmentItem.innerHTML = `
      <div class="segment-name">${segment.name}</div>
      <div class="segment-details">
        ${segment.distance ? (segment.distance / 1000).toFixed(2) + " km" : ""} 
        ${
  segment.average_grade ? " • " + segment.average_grade + "% grade" : ""
}
        ${segment.city ? " • " + segment.city : ""}
      </div>
    `;

    segmentItem.addEventListener("click", () => {
      state.selectedSegmentId = segment.id;
      downloadGpxButton.disabled = false;
      renderSegmentsList(); // Re-render to show selected state
    });

    segmentsList.appendChild(segmentItem);
  });
}

// Download selected segment as GPX
async function downloadSelectedSegmentAsGPX() {
  if (!state.selectedSegmentId) return;

  setLoading(true);
  try {
    const selectedSegment = state.segments.find(
      (s) => s.id === state.selectedSegmentId
    );
    const coordinates = await getSegmentPolyline(state.selectedSegmentId);
    const gpxContent = convertToGPX(coordinates, selectedSegment.name);

    // Create and download the file
    const blob = new Blob([gpxContent], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `segment-${state.selectedSegmentId}.gpx`;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    handleError(error);
  } finally {
    setLoading(false);
  }
}

// Handle errors
function handleError(error) {
  console.error("Error:", error);
  state.error = error.message || "An unknown error occurred";

  segmentsError.textContent = state.error;
  segmentsError.style.display = "block";
}

// Set loading state
function setLoading(isLoading) {
  state.isLoading = isLoading;

  // Update UI for loading state
  if (isLoading) {
    loginButton.disabled = true;
    logoutButton.disabled = true;
    refreshButton.disabled = true;
    downloadGpxButton.disabled = true;
  } else {
    loginButton.disabled = false;
    logoutButton.disabled = false;
    refreshButton.disabled = false;
    downloadGpxButton.disabled = !state.selectedSegmentId;
  }
}

// Update the authentication UI
function updateAuthUI() {
  if (state.isAuthenticated) {
    authStatus.textContent = "Logged in";
    authStatus.style.color = "#28a745";
    loginButton.style.display = "none";
    logoutButton.style.display = "block";
    profileSection.style.display = "block";
    segmentsSection.style.display = "block";
  } else {
    authStatus.textContent = "Not logged in";
    authStatus.style.color = "#dc3545";
    loginButton.style.display = "block";
    logoutButton.style.display = "none";
    profileSection.style.display = "none";
    segmentsSection.style.display = "none";
  }
}
