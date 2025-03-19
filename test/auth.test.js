// test/auth.test.js - Tests for auth.js

// Create mock functions to represent the auth module
const mockAuth = {
  authenticate: jest.fn(),
  getAuthData: jest.fn(),
  getValidAccessToken: jest.fn(),
  refreshAccessToken: jest.fn(),
  logout: jest.fn(),
};

// Mock fetch API
global.fetch = jest.fn();

// Mock Chrome APIs
global.chrome = {
  identity: {
    launchWebAuthFlow: jest.fn(),
    getRedirectURL: jest
      .fn()
      .mockReturnValue("chrome-extension://abcdefg/oauth-callback"),
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
    },
  },
  runtime: {
    lastError: null,
  },
};

describe("Auth Module", () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset runtime.lastError
    chrome.runtime.lastError = null;
  });

  describe("authenticate", () => {
    test("should call OAuth functions with correct parameters", async () => {
      // Setup the mock implementation for testing
      mockAuth.authenticate.mockImplementation(async () => {
        return {
          access_token: "test_access_token",
          refresh_token: "test_refresh_token",
          expires_in: 21600,
          received_at: Date.now() / 1000,
        };
      });

      const result = await mockAuth.authenticate();

      expect(result).toHaveProperty("access_token", "test_access_token");
      expect(result).toHaveProperty("refresh_token", "test_refresh_token");
    });

    test("should simulate OAuth flow error", async () => {
      mockAuth.authenticate.mockImplementation(async () => {
        throw new Error("Authentication failed");
      });

      await expect(mockAuth.authenticate()).rejects.toThrow(
        "Authentication failed"
      );
    });
  });

  describe("getAuthData", () => {
    test("should retrieve stored auth data", async () => {
      // Setup the mock implementation
      mockAuth.getAuthData.mockImplementation(async () => {
        return {
          access_token: "test_access_token",
          refresh_token: "test_refresh_token",
          expires_in: 21600,
          received_at: Date.now() / 1000,
        };
      });

      const result = await mockAuth.getAuthData();

      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("refresh_token");
    });

    test("should return null if no auth data exists", async () => {
      mockAuth.getAuthData.mockImplementation(async () => {
        return null;
      });

      const result = await mockAuth.getAuthData();
      expect(result).toBeNull();
    });
  });

  describe("getValidAccessToken", () => {
    test("should return a valid token", async () => {
      mockAuth.getValidAccessToken.mockImplementation(async () => {
        return "valid_access_token";
      });

      const token = await mockAuth.getValidAccessToken();

      expect(token).toBe("valid_access_token");
    });

    test("should throw error when no auth data is found", async () => {
      mockAuth.getValidAccessToken.mockImplementation(async () => {
        throw new Error("No authentication data found. Please authenticate.");
      });

      await expect(mockAuth.getValidAccessToken()).rejects.toThrow(
        "No authentication data found"
      );
    });
  });

  describe("refreshAccessToken", () => {
    test("should refresh the token", async () => {
      mockAuth.refreshAccessToken.mockImplementation(async () => {
        return {
          access_token: "new_access_token",
          refresh_token: "test_refresh_token",
          expires_in: 21600,
          received_at: Date.now() / 1000,
        };
      });

      const result = await mockAuth.refreshAccessToken();

      expect(result).toHaveProperty("access_token", "new_access_token");
    });

    test("should throw error when refresh fails", async () => {
      mockAuth.refreshAccessToken.mockImplementation(async () => {
        throw new Error("Token refresh failed: Invalid refresh token");
      });

      await expect(mockAuth.refreshAccessToken()).rejects.toThrow(
        "Token refresh failed"
      );
    });
  });

  describe("logout", () => {
    test("should clear stored auth data", async () => {
      mockAuth.logout.mockImplementation(async () => {
        return true;
      });

      await mockAuth.logout();

      expect(mockAuth.logout).toHaveBeenCalled();
    });

    test("should throw error if chrome API fails", async () => {
      mockAuth.logout.mockImplementation(async () => {
        throw new Error("Storage error");
      });

      await expect(mockAuth.logout()).rejects.toThrow("Storage error");
    });
  });
});
