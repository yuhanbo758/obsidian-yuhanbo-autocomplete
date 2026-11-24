module.exports = {
  setupFiles: ["<rootDir>/scripts/jest-setup.cjs"],
  transform: {
    "^.+\\.tsx?$": "<rootDir>/scripts/jest-transform.cjs",
  },
};
