module.exports = {
  testEnvironment: "jsdom",
  transform: {
    "\\.js$": ["babel-jest"],
  },
  setupFiles: ["./test/setup.js"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
