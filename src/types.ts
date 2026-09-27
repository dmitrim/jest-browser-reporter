/**
 * Outcome of a single test.
 *
 * - `pass` / `fail` — the test ran.
 * - `skip` — the test did not run: `.skip`, not focused while `.only` tests exist, or excluded by a run filter.
 * - `cancel` — the test was selected, but the run was stopped before it started.
 */
export type TestStatus = 'pass' | 'fail' | 'skip' | 'cancel';

/** Status filter of the results table: a single status, or `all`. */
export type StatusFilter = 'all' | TestStatus;

/** Identity of a test, available before and after it runs. */
export interface TestInfo {
    /** The test name, as passed to `it()` / `test()`. */
    name: string;
    /** Names of the enclosing `describe` blocks, outermost first. */
    suitePath: string[];
    /**
     * `suitePath` and `name` joined with `' › '`. Identifies the test across runs;
     * used by {@link RunOptions.tests} and {@link JestBrowserReporter.runFailed}.
     */
    fullName: string;
}

/** Result of a single test. */
export interface TestResult extends TestInfo {
    /** Outcome of the test. */
    status: TestStatus;
    /** Error messages with stack traces; empty unless the test failed. */
    errors: string[];
    /** Run time in milliseconds; `null` if the test did not run. */
    duration: number | null;
    /**
     * Run time in milliseconds the last time the test ran before this result, as remembered by the
     * reporter (in `localStorage` when settings persist); `null` if unknown.
     */
    previousDuration?: number | null;
    /** Source code of the test function. */
    sourceCode?: string;
    /** `true` if the test was skipped only because the run filter excluded it. */
    filteredOut?: boolean;
    /**
     * Raw jest-lite path: `'ROOT_DESCRIBE_BLOCK'`, then {@link suitePath}, then {@link name}.
     * @deprecated Use {@link suitePath}, {@link name} or {@link fullName}.
     */
    testPath: string[];
}

/**
 * Selects tests to run.
 *
 * - `string` — tests whose name, or the name of an enclosing `describe`, contains the text.
 * - `RegExp` — tests whose {@link TestInfo.fullName} matches.
 * - function — tests for which it returns `true`.
 */
export type TestFilter = string | RegExp | ((test: TestInfo) => boolean);

/**
 * Options of {@link JestBrowserReporter.run}. All given criteria must match.
 * Without any, the usual `.only` / `.skip` rules decide what runs. With any, `.only` is
 * ignored, so tests outside the focus can be run. `.skip` tests run only when named in
 * {@link RunOptions.tests}; a `filter` alone never selects them.
 */
export interface RunOptions {
    /** Runs only tests matching the filter. */
    filter?: TestFilter;
    /** Runs only the tests with these {@link TestInfo.fullName | full names} — `.skip` ones included. */
    tests?: readonly string[];
    /** Runs only the tests that failed last time. */
    onlyFailed?: boolean;
    /**
     * Stops the run when aborted, like {@link JestBrowserReporter.stop}.
     * A test that is already running is not interrupted: the run stops after it.
     */
    signal?: AbortSignal;
}

/** Number of tests per status. */
export interface StatusCounts {
    /** All counted tests. */
    total: number;
    /** Tests that passed. */
    pass: number;
    /** Tests that failed. */
    fail: number;
    /** Tests that were skipped. */
    skip: number;
    /** Tests cancelled by a stopped run. */
    cancel: number;
}

/** Outcome of a test run. */
export interface RunSummary {
    /** Results of all registered tests, in registration order. */
    results: TestResult[];
    /** Counts over {@link results}, not including tests excluded by the run filter. */
    counts: StatusCounts;
    /** Start time, as a `Date.now()` timestamp. */
    startedAt: number;
    /** Duration of the run in milliseconds. */
    durationMs: number;
    /** `true` if the run was stopped before all selected tests ran. */
    aborted: boolean;
    /** Navigations away from the page that tests attempted and the reporter blocked (see {@link JestBrowserReporterOptions.blockNavigation}). */
    blockedNavigations: BlockedNavigation[];
}

/** A navigation away from the page, attempted by a test and blocked. */
export interface BlockedNavigation {
    /** Full name of the test that was running, or `null` if none was (e.g. during a hook). */
    test: string | null;
    /** Where the page would have gone. */
    url: string;
}

/** Events of {@link JestBrowserReporter.on}, with the payload type of each. */
export interface ReporterEventMap {
    /** A run started. */
    runStart: {
        /** Number of tests selected to run. */
        testCount: number;
        /**
         * Expected duration of the run in milliseconds, from the remembered durations of the selected
         * tests (tests never run count as the average); `null` when no durations are known.
         */
        estimatedMs: number | null;
    };
    /** A test started. */
    testStart: TestInfo;
    /** A test finished, was skipped or was cancelled. */
    testDone: TestResult;
    /** A run finished, including a stopped one. */
    runFinish: RunSummary;
}

/** Color theme; `auto` follows the operating system setting. */
export type ReporterTheme = 'light' | 'dark' | 'auto';

/** Options of {@link JestBrowserReporter}. */
export interface JestBrowserReporterOptions {
    /** Element, or CSS selector of the element, to render into. Defaults to `document.body`. */
    container?: HTMLElement | string;
    /** Heading shown above the results. */
    title?: string;
    /**
     * Shows a link above the results: `true` goes back in history, a string is a URL.
     * @defaultValue `false`
     */
    backLink?: boolean | string;
    /** @deprecated Use {@link backLink}. */
    showBackLink?: boolean;
    /**
     * Groups results by top-level `describe`. A saved setting takes precedence.
     * @defaultValue `false`
     */
    groupBySuite?: boolean;
    /**
     * Starts a run as soon as the reporter is created (for {@link createTestPage}: once the tests are loaded).
     *
     * - `true` or `'filtered'` — runs what the saved filter selects: the tests matching the saved search
     *   text, and only the remembered failed tests when the saved status filter is "Failed". Without a
     *   saved filter, all tests run. A limited run is announced above the results, with a button to run all.
     * - `'all'` — always runs all tests.
     *
     * `run()` and "Run All" are not affected: they always run all tests.
     * @defaultValue `false`
     */
    autoRun?: boolean | 'filtered' | 'all';
    /**
     * Remembers the status filter, search text, grouping, collapsed groups and the failed tests
     * in `localStorage`, and restores them on the next visit.
     * @defaultValue `true`
     */
    persistSettings?: boolean;
    /**
     * `localStorage` key for the saved settings. Set it when several test pages share a path.
     * @defaultValue `'jest-browser-reporter:' + location.pathname`
     */
    storageKey?: string;
    /** @defaultValue `'light'` */
    theme?: ReporterTheme;
    /** Default timeout in milliseconds for tests and hooks; same as calling `jest.setTimeout()`. */
    defaultTimeout?: number;
    /**
     * While tests run, silently cancels navigations started by scripts — `location.href = …`,
     * `location.reload()`, `location` assigned an object — and reports them in a notice and in
     * {@link RunSummary.blockedNavigations}; the run goes on. Downloads, `#hash` / `pushState` changes and
     * navigations by the user are not affected. Needs the Navigation API (Chromium 102+, recent Firefox
     * and Safari); elsewhere, {@link confirmLeaveWhileRunning} and the interrupted-run notice remain.
     * @defaultValue `true`
     */
    blockNavigation?: boolean;
    /**
     * Asks for confirmation before the page is closed, reloaded or navigated away while tests run.
     * Browsers show the prompt only after the user has interacted with the page.
     * @defaultValue `true`
     */
    confirmLeaveWhileRunning?: boolean;
    /**
     * Reads options from the page URL: `?autorun` starts a run like `autoRun: true`; `?grep=text`
     * limits it to tests matching `text` (as a string {@link TestFilter}) instead of the saved filter.
     * @defaultValue `true`
     */
    urlParams?: boolean;
}

/** Options of {@link createTestPage}. */
export interface TestPageOptions extends JestBrowserReporterOptions {
    /**
     * Loads the test files, typically `() => import('./tests')`. It is called after the test
     * globals (`describe`, `it`, `expect`, …) are installed, so the files can use them.
     */
    tests: () => unknown | Promise<unknown>;
}
