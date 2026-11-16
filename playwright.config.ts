import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:3105",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: {
    command: "npx next start -p 3105",
    url: "http://localhost:3105/sign-in",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      ...process.env,
      PGLITE_DATA_DIR: "memory://",
      BETTER_AUTH_URL: "http://localhost:3105",
    },
  },
});
