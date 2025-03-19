# strava_plugin# Strava Plugin

A Chrome extension for Strava.

## Development Setup

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/strava_plugin.git
   cd strava_plugin
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension for development:
   ```bash
   npm run build:dev
   ```

4. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in the top-right corner)
   - Click "Load unpacked" and select the `dist` directory from this project

## Testing

Run tests with:
```bash
npm test
```

## Building for production

1. Build the extension:
   ```bash
   npm run build
   ```

2. Package as .crx (requires a key.pem file):
   ```bash
   npm run package
   ```

## CI/CD Pipeline

This project uses GitHub Actions for continuous integration and delivery:

- **Feature Branches**: Every push triggers linting, testing, and a development build
- **Main Branch**: Pushing to main triggers a full CI/CD pipeline that:
  - Runs all tests
  - Creates a production build
  - Packages the extension as .crx
  - Creates a GitHub release
  - Uploads build artifacts

## Installing the Extension

### Development Version
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `dist` directory

### Production Version
1. Download the latest .crx file from the [Releases page](https://github.com/yourusername/strava_plugin/releases)
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Drag and drop the .crx file onto the extensions page.

## Project Structure

```
strava_plugin/
├── .github/workflows/ - GitHub Actions configuration
├── dist/              - Build output (generated)
├── public/            - Static assets
│   ├── images/        - Extension icons
│   └── popup.html     - Extension popup HTML
├── scripts/           - Build and utility scripts
├── src/               - Source code
├── test/              - Test files
└── ... (configuration files)
```