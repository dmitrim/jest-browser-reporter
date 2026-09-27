// Runs the test page in headless Chromium and exits with code 1 if any test fails.
//   node run-in-ci.mjs [grep]
import { createServer } from 'vite';
import { chromium } from 'playwright';

const grep = process.argv[2];
const TIMEOUT_MS = 10 * 60 * 1000;

const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
const url = new URL('index.html', server.resolvedUrls.local[0]);
url.searchParams.set('autorun', '');
if (grep) url.searchParams.set('grep', grep);

const browser = await chromium.launch();
let exitCode = 1;
try {
    const page = await browser.newPage();
    page.on('pageerror', error => console.error('Page error:', error.message));
    await page.goto(url.href);

    // The reporter puts the run summary on window.__JEST_BROWSER_RESULTS__ when a run finishes.
    const handle = await page.waitForFunction(() => window.__JEST_BROWSER_RESULTS__, null, { timeout: TIMEOUT_MS });
    const summary = await handle.jsonValue();

    for (const result of summary.results.filter(r => r.status === 'fail')) {
        console.error(`✕ ${result.fullName}\n${result.errors.join('\n')}\n`);
    }
    const { total, pass, fail, skip } = summary.counts;
    console.log(`${total} tests: ${pass} passed, ${fail} failed, ${skip} skipped (${summary.durationMs} ms)`);
    exitCode = fail > 0 ? 1 : 0;
} finally {
    await browser.close();
    await server.close();
}
process.exit(exitCode);
