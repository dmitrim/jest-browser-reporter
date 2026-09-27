# jest-browser-reporter

[![npm](https://img.shields.io/npm/v/jest-browser-reporter)](https://www.npmjs.com/package/jest-browser-reporter)
[![license](https://img.shields.io/npm/l/jest-browser-reporter)](LICENSE)

Run Jest-style tests **in a real browser** and watch the results on the page as they arrive.

Write `describe` / `it` / `expect` the way you do in Jest, open one HTML page, press **Run All**.
Good for code that needs real browser APIs — canvas, WebAssembly, workers, fonts, `fetch` —
without a Node.js DOM emulation.

![jest-browser-reporter screenshot](https://raw.githubusercontent.com/dmitrim/jest-browser-reporter/main/docs/screenshot.png)

- **Every test listed** from the start (*not run* until it runs); **live results** with a progress bar and the estimated time left
- **Stop** a run at any time; **Run Failed** re-runs just the failures; **Run Filtered** runs what the search shows; **▶ Run** on a suite or a row runs just that
- **Search**, status filters, grouping by suite, **sorting** by status, name or duration — all remembered for the next visit
- Durations like `850ms`, `1sec 234ms`, `2min 5sec`, with each test's **previous duration** (▲ slower / ▼ faster) and the total run time
- Error details and the test's **source code**, syntax-highlighted
- Light, dark or automatic **theme**
- **CI mode**: `?autorun` plus results on `window` for Playwright/Puppeteer
- Working `jest.fn()` / `jest.spyOn()`, `it.each`, timeouts, hooks, `.only` / `.skip` / `.todo`
- TypeScript types included; no dependencies

## Quick start

```bash
npm install --save-dev jest-browser-reporter
```

**`index.html`**

```html
<div id="app"></div>
<script type="module" src="./main.js"></script>
```

**`main.js`**

```js
import { createTestPage } from 'jest-browser-reporter';

createTestPage({
    container: '#app',
    title: 'My tests',
    tests: () => import('./tests/index.js'),   // your test files
});
```

**`tests/math.test.js`** — no imports needed:

```js
describe('Math', () => {
    it('adds', () => {
        expect(1 + 2).toBe(3);
    });
});
```

Serve the folder with any dev server (`npx vite`, for example) and open the page.

`createTestPage()` installs the globals *before* it calls `tests()`, so there is no script
order to get wrong. More setups — TypeScript, a plain `<script>` tag, CI — are in [Examples](#examples).

## Using the page

| | |
|---|---|
| **Run All** / **Stop** | Runs every test / stops after the test that is running; the rest are reported as *cancelled* |
| **Run Failed (N)** | Runs only the tests that failed last time — remembered across reloads |
| **Run Filtered (N)** | Runs exactly the tests the table shows for the current search text and status filter; before the first run, the search applies to the registered tests |
| **▶ Run** on a row | Runs just that test; the other rows keep their previous result, dimmed |
| **Export JSON** | Downloads the shown results |
| Search, status filters, **Group by Suite** | Filter the table; the choice is saved in `localStorage`. Separate alternatives with `\|` to match any of them: `Signature \| Licensing` |
| **▶ Run** on a suite header | Runs what the suite shows (search and status filter apply, `.skip` tests are left out); shown when grouped by suite |
| Column headers | Sort by status (failures first), test name or duration: ascending → descending → registration order |
| Duration column | This run's time and, below it, the previous time of the test, with ▲ / ▼ when it changed by over 20% |
| `Ctrl+Enter` / `Ctrl+Shift+Enter` / `Ctrl+F` / `Esc` | Run all / run filtered / focus search / clear search |
| `?autorun`, `?grep=text` | Start a run on load (like `autoRun: true`) / limit it to tests matching `text` |

An **automatic run** (`autoRun: true` or `?autorun`) respects the saved filter: after a reload with a search
text, only the matching tests run; with the status filter "Failed", only the tests that failed last time.
A notice above the results says so and offers **Run all tests**. `autoRun: 'all'` always runs everything;
**Run All** and `run()` are never limited.

Test durations and the time of the last full run are remembered in `localStorage` (with the other settings);
from them the progress bar shows the estimated time left, and the summary shows the total run time next to
the previous one.

While tests run, a test **cannot navigate the page away**: `location.href = …`, `location.reload()` or a
`location` assigned an object are silently cancelled, and a notice names the test and the address it tried to
open; the run goes on (downloads and `#hash` changes are not affected). This needs the Navigation API
(Chromium 102+, recent Firefox and Safari). Closing or reloading the page yourself asks for confirmation.
If the page is left anyway,
the next load tells which test was running at the time, and does not start an automatic run — so a test that
navigates away cannot restart the run in a loop.

## Supported test API

| API | Support |
|---|---|
| `describe`, `it`, `test` + `.only`, `.skip`; `fdescribe`, `fit`, `xdescribe`, `xit`, `xtest` | ✅ |
| `it.each`, `test.each`, `describe.each` (array tables, `%s %d %i %f %j %o %p %#`, `$property`) | ✅ — the tagged template form is not supported |
| `it.todo` | ✅ reported as skipped |
| `beforeAll`, `afterAll`, `beforeEach`, `afterEach` (sync, async, `done` callback) | ✅ |
| Async tests: `async`, returned promise, `done` callback; per-test timeout (3rd argument) | ✅ |
| `expect` matchers: `toBe`, `toEqual`, `toMatchObject`, `toContain`, `toContainEqual`, `toHaveLength`, `toHaveProperty`, `toMatch`, `toThrow`, `toBeCloseTo`, `toBeGreaterThan[OrEqual]`, `toBeLessThan[OrEqual]`, `toBeTruthy` / `Falsy` / `Null` / `Undefined` / `Defined` / `NaN`, `toBeInstanceOf`, `toHaveBeenCalled[Times\|With]`, `toHaveBeenLastCalledWith` | ✅ |
| `.not`, `.resolves`, `.rejects` (including `rejects.toThrow()`) | ✅ |
| `expect.any`, `anything`, `arrayContaining`, `objectContaining`, `stringContaining`, `stringMatching`, `assertions`, `hasAssertions`, `extend` | ✅ |
| `jest.fn`, `jest.spyOn`, `jest.isMockFunction`, `clearAllMocks`, `resetAllMocks`, `restoreAllMocks`, `jest.setTimeout` | ✅ |
| `toStrictEqual`, `toHaveReturned*`, `toMatchSnapshot`, `toMatchInlineSnapshot` | ❌ |
| `jest.mock`, `jest.requireActual`, fake timers (`useFakeTimers`, `advanceTimersByTime`, …), `retryTimes` | ❌ throw an error saying so |

## API

Full reference: open `node_modules/jest-browser-reporter/docs/index.html` — generated from the
TypeScript declarations, shipped in the package.

### `createTestPage(options)`

Installs the globals, renders the reporter, loads the tests and — with `autoRun` or `?autorun` —
starts a run. Returns a promise of the `JestBrowserReporter`. If loading the tests fails, the error
is shown on the page.

### `new JestBrowserReporter(options?)`

For full control — e.g. when the tests are already loaded.

| Option | Default | |
|---|---|---|
| `container` | `document.body` | Element or CSS selector |
| `title` | — | Heading above the results |
| `backLink` | `false` | `true` for "← Back" (history), or a URL |
| `groupBySuite` | `false` | Group by top-level `describe` |
| `autoRun` | `false` | Start a run right away: `true` (or `'filtered'`) runs what the saved search / "Failed" filter selects, `'all'` runs everything |
| `persistSettings` | `true` | Remember filters, search, grouping, sorting, collapsed groups, failed tests and test durations |
| `storageKey` | `'jest-browser-reporter:' + location.pathname` | `localStorage` key |
| `theme` | `'light'` | `'light'`, `'dark'` or `'auto'` |
| `defaultTimeout` | `5000` | Test and hook timeout, ms; same as `jest.setTimeout()` |
| `blockNavigation` | `true` | Cancel navigations started by tests during a run, and report them |
| `confirmLeaveWhileRunning` | `true` | Ask before leaving the page during a run |
| `urlParams` | `true` | Honor `?autorun` and `?grep=` |

| Member | |
|---|---|
| `run(options?)` | Runs tests and resolves with a `RunSummary` (`results`, `counts`, `durationMs`, `aborted`, `blockedNavigations`). `options`: `filter` (string, `RegExp` or `(test) => boolean`), `tests` (full names), `onlyFailed`, `signal` (`AbortSignal`) |
| `runFailed()` | `run({ onlyFailed: true })` |
| `runFiltered()` | Runs the tests the table shows for the current search and status filter |
| `stop()` | Stops after the running test |
| `on(event, handler)` | `'runStart'`, `'testStart'`, `'testDone'`, `'runFinish'`; returns an unsubscribe function |
| `results`, `lastRun`, `failedTests`, `isRunning` | Read-only state |
| `render(results)` | Shows results produced elsewhere |
| `destroy()` | Removes the reporter from the page |

```js
const summary = await reporter.run({ filter: /Signature/, signal: AbortSignal.timeout(60_000) });
console.log(summary.counts); // { total, pass, fail, skip, cancel }
```

A test's **full name** is its `describe` names and its own name joined with `' › '`, e.g.
`'Cart › totals items'`; `tests` and the saved failed tests use it.

### `jest-browser-reporter/globals`

Import it for its side effect to install the globals yourself, before the tests:

```js
import 'jest-browser-reporter/globals';
import './tests/index.js';
```

In TypeScript it also **types** the globals. Use it (or `/// <reference types="jest-browser-reporter/globals" />`)
*instead of* `@types/jest` — both declare the same names.

`setupJestLiteGlobals()` does the same as a function; `resetJestLiteGlobals()` removes them.

### CI

Open the page with `?autorun` in a headless browser and wait for `window.__JEST_BROWSER_RESULTS__`:
the reporter sets it to the run summary when the run finishes, and dispatches a
`jest-browser-reporter:finish` event on `window`.

```js
await page.goto('http://localhost:5173/tests.html?autorun');
const summary = await (await page.waitForFunction(() => window.__JEST_BROWSER_RESULTS__)).jsonValue();
process.exit(summary.counts.fail ? 1 : 0);
```

A complete script is in [`examples/ci-playwright`](https://github.com/dmitrim/jest-browser-reporter/tree/main/examples/ci-playwright).

### Without a bundler

The UMD build exposes everything as `window.JestBrowserReporter`:

```html
<script src="https://cdn.jsdelivr.net/npm/jest-browser-reporter@2/umd/index.js"></script>
<script>JestBrowserReporter.setupJestLiteGlobals();</script>
<script src="./my.test.js"></script>
<script>new JestBrowserReporter.JestBrowserReporter({ title: 'My tests' });</script>
```

## Examples

Shipped in the package under `examples/`:

| | |
|---|---|
| [`quick-start`](https://github.com/dmitrim/jest-browser-reporter/tree/main/examples/quick-start) | `createTestPage()` and two test files |
| [`typescript`](https://github.com/dmitrim/jest-browser-reporter/tree/main/examples/typescript) | TypeScript tests with typed globals |
| [`script-tag`](https://github.com/dmitrim/jest-browser-reporter/tree/main/examples/script-tag) | No build step: UMD from a CDN |
| [`features`](https://github.com/dmitrim/jest-browser-reporter/tree/main/examples/features) | Hooks, `.skip`, `.todo`, `.each`, timeouts, mocks, async tests, grouping, dark theme |
| [`programmatic-api`](https://github.com/dmitrim/jest-browser-reporter/tree/main/examples/programmatic-api) | `run({ filter })`, `runFailed()`, `stop()`, `AbortSignal`, events |
| [`ci-playwright`](https://github.com/dmitrim/jest-browser-reporter/tree/main/examples/ci-playwright) | Headless run in CI that fails the build on test failures |

## Good to know

- Tests run **in the page itself**, one at a time. A test that tries to navigate away — for example by
  assigning `window.location` — is stopped from doing so where the Navigation API exists; elsewhere it ends
  the run, and the page reports where it stopped.
- There are no fake timers: timers and `Date` are real.
- A test that is running cannot be interrupted; **Stop** takes effect after it.
- Tests are identified by their full name; give tests in the same `describe` distinct names.
- Patterns (search, **Run Filtered**, `run({ filter })`, `?grep`, auto-run) never select `.skip` tests, like Jest's `-t`;
  to run a skipped test anyway, use **▶ Run** in its row (or `run({ tests: [fullName] })`). All of them ignore `.only`.

## Migrating from 1.x

Existing 1.x pages keep working. Changes to be aware of:

- `run()` resolves with a `RunSummary` instead of an array of results: use `summary.results`.
  `run('text')` still works but is deprecated: use `run({ filter: 'text' })`.
- Results have `name`, `suitePath` and `fullName`; `testPath` is deprecated.
- The status `cancel` is new (tests not run because the run was stopped).
- `showBackLink` is deprecated: use `backLink`.
- The fields `currentFilter`, `currentSearch`, `groupBySuite` and `elements` are gone; `results` and
  `isRunning` are now read-only.
- `jest.fn()` / `jest.spyOn()` are now real mocks; unsupported `jest.*` functions throw instead of
  only logging a warning.
- Importing the package no longer sets `window.JestBrowserReporter` to the class. In the UMD build
  `window.JestBrowserReporter` is the namespace: use `new JestBrowserReporter.JestBrowserReporter()`.
- The global `run()` still exists but is deprecated: use the reporter.

See the [changelog](https://github.com/dmitrim/jest-browser-reporter/blob/main/docs/CHANGELOG.md) for the full list.

## License

[MIT](LICENSE)
