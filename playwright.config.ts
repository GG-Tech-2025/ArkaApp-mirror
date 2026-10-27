import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

// The app is pointed at a made-up Supabase host; every request to it is answered by
// the tests (see e2e/support/supabase-mock.ts), so e2e runs never touch a real project.
export const FAKE_SUPABASE_URL = 'https://arka-e2e.supabase.test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chrome',
      // Uses the Chrome already installed on the machine; no browser download needed.
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort --open false`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SUPABASE_URL: FAKE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: 'e2e-publishable-key',
    },
  },
});
