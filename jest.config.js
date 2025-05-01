/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest', // Standard preset for CJS
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    // Use ts-jest for project's TS files
    '^.+\\.tsx?$': 'ts-jest',
    // Use babel-jest *only* for JS/MJS files inside the specific dependency
    '<rootDir>/node_modules/@xenova/transformers/.+\\.(js|mjs)$': 'babel-jest',
  },
  // Ensure Jest doesn't ignore the dependency we *do* want to transform with babel-jest
  transformIgnorePatterns: [
    // Ignore all node_modules EXCEPT @xenova/transformers
    '/node_modules/(?!@xenova/transformers/)',
  ],
  // testTimeout: 30000,
};
