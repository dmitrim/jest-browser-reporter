# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - Unreleased
### Added
- `createTestPage()`: installs the globals, renders the reporter, loads the tests and optionally starts a run, in one call.
- `jest-browser-reporter/globals` entry point: installs the globals on import and declares their TypeScript types.
- The table lists every registered test from the start: tests without a result show as *NOT RUN* (`.skip` ones as *SKIP*) and can be searched and run from their row.
- Results appear while the run is in progress, with a progress bar and the name of the running test.
- **Stop** button and `reporter.stop()`; `run({ signal })` accepts an `AbortSignal`. Tests not run are reported with the new status `cancel`.
- **Run Failed** button and `reporter.runFailed()`. Failed tests are remembered across visits.
- **Run Filtered** button (Ctrl+Shift+Enter) and `reporter.runFiltered()`: run the tests found by the search and the status filter.
- A filtered run (a row's **▶ Run**, **Run Failed**, `run({ filter })`) keeps the results of the other tests, dimmed as not run this time.
- `run()` options: `filter` (string, `RegExp` or predicate), `tests` (full names), `onlyFailed`, `signal`. It resolves with a `RunSummary`.
- `reporter.on('runStart' | 'testStart' | 'testDone' | 'runFinish', handler)`.
- Read-only `results`, `lastRun`, `failedTests`, `isRunning`.
- Filters, search, grouping and collapsed groups are saved in `localStorage` and restored (`persistSettings`, `storageKey`).
- Navigations started by tests during a run (`location.href = …`, `location.reload()`, `location` assigned an object) are cancelled and reported in a notice and in `RunSummary.blockedNavigations` (`blockNavigation` option; needs the Navigation API).
- Confirmation before leaving the page during a run (`confirmLeaveWhileRunning`), and a notice on the next load naming the test that was running when the page was left.
- CI mode: `?autorun` and `?grep=` URL parameters; the summary is published as `window.__JEST_BROWSER_RESULTS__` together with a `jest-browser-reporter:finish` event.
- **Export JSON** button.
- An automatic run is not started when the previous run did not finish, so a test that navigates the page away cannot restart runs forever.
- An automatic run (`autoRun: true`, `?autorun`) runs what the saved search and "Failed" filter select, announced by a notice with a **Run all tests** button; `autoRun: 'all'` always runs everything.
- Sorting by status, test name or duration by clicking a column header; the sort is remembered.
- Durations are formatted by size: `850ms`, `1sec 234ms`, `2min 5sec`, `1h 3min`.
- Test durations are remembered: each row shows the test's previous duration (▲ slower / ▼ faster), results carry `previousDuration`, the progress shows the estimated time left, the summary shows the run time next to the previous one, and the `runStart` event carries `estimatedMs`.
- Options `title`, `backLink` (boolean or URL), `theme` (`light` / `dark` / `auto`), `defaultTimeout`, `urlParams`; `container` also accepts a CSS selector.
- `it.each`, `test.each`, `describe.each` and `it.todo`.
- Real `jest.fn()`, `jest.spyOn()`, `jest.isMockFunction()`, `clearAllMocks()`, `resetAllMocks()`, `restoreAllMocks()` (jest-mock, bundled with jest-lite).
- `expect(promise).rejects.toThrow()`.
- Results carry `name`, `suitePath`, `fullName`, `sourceCode` and `filteredOut`.
- TypeScript types for the test globals, API documentation in `docs/`, and examples in `examples/`.

### Changed
- `run()` resolves with a `RunSummary` instead of an array of results.
- A row's **▶ Run** runs exactly that test; before, it ran every test whose name contained its name.
- A pattern (search, **Run Filtered**, `run({ filter })`, `?grep`, auto-run) no longer selects `.skip` tests; a row's **▶ Run** and `run({ tests })` still run a `.skip` test on request. `.only` is ignored by all of them.
- Error details and source code are highlighted when first opened, not for every row up front.
- The Prism theme is scoped to the reporter and no longer restyles the host page's code blocks.
- Unsupported `jest.*` functions throw an error instead of logging a warning.
- The package no longer sets `window.JestBrowserReporter` on import; the UMD build exposes the namespace there.
- Sources split into modules: `reporter/`, `runner/`, `utils/`.

### Deprecated
- `run(string)`: use `run({ filter })`.
- `showBackLink`: use `backLink`.
- `TestResult.testPath`: use `suitePath`, `name` or `fullName`.
- The global `run()`.

### Removed
- The mutable fields `currentFilter`, `currentSearch`, `groupBySuite` and `elements` of `JestBrowserReporter`.

### Fixed
- Errors of a failing test accumulated with every re-run.
- `.only` inside a nested `describe` was ignored when the outer `describe` had no focused tests of its own.
- The "Test execution failed" banner was hidden right after being shown.
- Expanding a collapsed suite group showed rows hidden by the current filter or search.
- HTML entities (e.g. `&amp;`) appeared in the "Running test: …" status line.
- The Duration column was always empty.
- The `unpkg` field pointed to a file that does not exist.

## [1.0.3] - 2025-12-02
### Added
- Now displays the name of the currently running test.

## [1.0.2] - 2025-12-02
### Added
- Custom test timeout support: Added comprehensive timeout configuration with two approaches:
  - Per-test timeout: Set individual timeouts by passing a timeout value as the third argument
  - Global timeout configuration: Use jest.setTimeout() to set default timeout for multiple tests
Per-test timeout example:
```javascript
// Set a 10-second timeout for a specific async test
test('async operation with custom timeout', async () => {
    await new Promise(resolve => setTimeout(resolve, 7500));
}, 10000);
```

Global timeout configuration example:
```javascript
// Set global timeout for all tests in describe block
beforeAll(() => {
    jest.setTimeout(20 * 1000); // 20 seconds
});

describe('long-running operations', () => {
    test('first long test', async () => {
        await new Promise(resolve => setTimeout(resolve, 7500));
    });
    
    test('second long test', async () => {
        await new Promise(resolve => setTimeout(resolve, 15000));
    });
});
```

Priority order:
  - Individual test timeout (third argument) - highest priority
  - jest.setTimeout() value
  - Default timeout (5000ms) - lowest priority

	
## [1.0.1] - 2025-10-03
### Fixed
- Console logs cleared.

## [1.0.0] - 2025-09-28
### Added
- Test results now include formatted source code view
 
## [1.0.0-a3] - 2025-09-27
### Added
- Optional `testNameFilter?: string` parameter in `JestBrowserReporter.run` to allow running only tests matching a specific name.
- `.only` and `.skip` support for describe blocks
  - `describe.only()` now runs only the specified test suite
  - `describe.skip()` now properly skips the specified test suite
  - Maintains compatibility with existing `it.only()` and `it.skip()`

### Fixed
- Ensure asynchronous `before` hooks are properly awaited before running tests.
- Fix jestLite (test-runner): support `.skip/.only` with proper async hooks

## [1.0.0-a2] - 2025-09-26
### Added
- Added `setupJestLiteGlobals` utility to automatically assign Jest Lite functions (`describe`, `it`, `expect`, `beforeAll`, `afterAll`, etc.) to the global scope, enabling Jest-like test execution in browser or Node environments.

### Fixed
- jest-browser-reporter: fix template strings and improve filters/search stability
  - Fixed unterminated template string errors in generated HTML
  - Normalized attribute spacing to avoid parsing issues
  - Improved filter logic for 'all' / 'pass' / 'fail' states
  - Ensured live-search works consistently with filters and grouping
  - Cleaned up event delegation and debounce handling


## [1.0.0-a1] - 2025-09-25

### Added
- Initial internal release.