// Mock chrome API
global.chrome = {
    runtime: {
      getManifest: jest.fn(() => ({
        version: '0.1.0'
      }))
    }
  };
  
  // Simple test for popup.js
  describe('Popup', () => {
    // Set up DOM
    document.body.innerHTML = `
      <div>
        <h1>Strava Plugin</h1>
        <p>Hello World! This is a test extension.</p>
      </div>
    `;
  
    // Load the script
    require('../src/popup.js');
    
    test('adds version information to the DOM', () => {
      // Simulate DOMContentLoaded
      const event = document.createEvent('Event');
      event.initEvent('DOMContentLoaded', true, true);
      document.dispatchEvent(event);
      
      // Check if version information was added
      const versionElement = document.querySelector('div:last-child');
      expect(versionElement).not.toBeNull();
      expect(versionElement.textContent).toBe('Version: 0.1.0');
    });
  });