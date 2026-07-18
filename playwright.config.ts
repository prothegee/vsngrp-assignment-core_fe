import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  use: {
    baseURL: "http://localhost:9003",
  },
  webServer: {
    command: "npm run dev",
    port: 9003,
    reuseExistingServer: true,
    timeout: 30000,
  },
});
