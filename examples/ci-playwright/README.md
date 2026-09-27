# CI with Playwright

Run the browser tests headless and fail the build when a test fails.

```bash
npm install
npx playwright install chromium
npm run test:ci             # all tests
node run-in-ci.mjs Canvas   # only tests matching "Canvas"
```

How it works — [`run-in-ci.mjs`](run-in-ci.mjs):

1. starts a Vite dev server for this folder;
2. opens `index.html?autorun` in headless Chromium — `?autorun` starts the run,
   `?grep=text` limits it;
3. waits for `window.__JEST_BROWSER_RESULTS__`, which the reporter sets when a run finishes
   (a `jest-browser-reporter:finish` event is dispatched on `window` at the same time);
4. prints the failures and exits with code 1 if there are any.

A CI step then only needs Node.js:

```yaml
# GitHub Actions
- run: npm ci
- run: npx playwright install --with-deps chromium
- run: npm run test:ci
```
