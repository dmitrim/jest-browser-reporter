import { defineConfig, devices } from '@playwright/test';

// Tests the built bundles in dist/: run `npm run build` (or `build:dev`) first.
export default defineConfig({
    testDir: 'tests/e2e',
    timeout: 60_000,
    reporter: process.env.CI ? 'line' : 'list',
    use: {
        baseURL: 'http://localhost:4179',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'npx vite --config tests/e2e/vite.config.ts',
        url: 'http://localhost:4179/tests/e2e/pages/reporter.html',
        reuseExistingServer: !process.env.CI,
    },
});
