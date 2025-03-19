// test/setup.js - Global test setup

// Mock modules that might cause issues in tests
jest.mock(
  "../src/auth",
  () => ({
    authenticate: jest.fn(),
    getAuthData: jest.fn(),
    getValidAccessToken: jest.fn(),
    refreshAccessToken: jest.fn(),
    logout: jest.fn(),
  }),
  { virtual: true }
);

// Set up global mocks
global.chrome = {
  runtime: {
    getManifest: jest.fn(() => ({
      version: "0.1.0",
    })),
    lastError: null,
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
    },
  },
  identity: {
    getRedirectURL: jest.fn(() => "https://example.com/redirect"),
    launchWebAuthFlow: jest.fn(),
  },
};
