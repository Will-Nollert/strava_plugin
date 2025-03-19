// src/background.js - Background service worker
console.log("Strava Plugin Background Service Worker Initialized");

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "AUTH_CHECK") {
    // Handle auth check requests
    chrome.storage.local.get(["strava_auth_data"], (result) => {
      const isAuthenticated = !!(
        result.strava_auth_data && result.strava_auth_data.access_token
      );
      sendResponse({ isAuthenticated });
    });
    return true; // Required for async sendResponse
  }

  if (message.type === "TOKEN_REFRESH_NEEDED") {
    // Will be implemented if needed when tokens expire
    console.log("Token refresh requested");
    // Actual token refresh logic would go here
    sendResponse({ success: true });
    return true; // Required for async sendResponse
  }
});

// Handle installation and updates
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("Extension installed");
    // You could open a welcome page or tutorial here
  } else if (details.reason === "update") {
    console.log("Extension updated");
    // You could show release notes or changelog here
  }
});

// Keep the service worker alive by responding to pings
// (Only needed if you're doing long-lived operations in the background)
// chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
// chrome.alarms.onAlarm.addListener((alarm) => {
//   if (alarm.name === 'keepAlive') {
//     console.log('Background service worker is still active');
//   }
// });
