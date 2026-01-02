const { createDefaultPreset } = require("ts-jest");

// Load .env.test to set up test environment variables
require('dotenv').config({ path: '.env.test' });

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
};