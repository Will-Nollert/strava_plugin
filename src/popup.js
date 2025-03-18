console.log("Strava Plugin Loaded");

// This is a simple "Hello World" script
document.addEventListener("DOMContentLoaded", function () {
  const versionSpan = document.createElement("div");
  versionSpan.textContent = `Version: ${chrome.runtime.getManifest().version}`;
  versionSpan.style.marginTop = "20px";
  versionSpan.style.textAlign = "center";
  document.body.appendChild(versionSpan);
});
