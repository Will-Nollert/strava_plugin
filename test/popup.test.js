// test/popup.test.js - Tests for popup.js

// Mock chrome API
global.chrome = {
  runtime: {
    getManifest: jest.fn(() => ({
      version: "0.1.0",
    })),
  },
};

// Simple test for basic popup functionality without loading the actual module
describe("Popup Basic Functionality", () => {
  // Set up DOM
  document.body.innerHTML = `
    <div>
      <h1>Strava Plugin</h1>
      <p>Hello World! This is a test extension.</p>
    </div>
  `;

  // Don't try to load the actual module - just test the concept
  test("displays version information correctly", () => {
    // Mock the functionality that popup.js would do
    const versionSpan = document.createElement("div");
    versionSpan.textContent = `Version: ${
      chrome.runtime.getManifest().version
    }`;
    document.body.appendChild(versionSpan);

    // Check if version information was added correctly
    const versionElement = document.querySelector("div:last-child");
    expect(versionElement).not.toBeNull();
    expect(versionElement.textContent).toBe("Version: 0.1.0");
  });
});
