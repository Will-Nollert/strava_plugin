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
  transformIgnorePatterns: ["/node_modules/(?!(.+?)\\.js$)"],
  moduleFileExtensions: ["js", "json", "jsx", "ts", "tsx", "node"],
};
