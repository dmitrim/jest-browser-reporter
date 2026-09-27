/**
 * Run Jest-style tests in the browser and see the results on the page.
 *
 * Start with {@link createTestPage}; use {@link JestBrowserReporter} directly for more control.
 * @module jest-browser-reporter
 */
export { createTestPage } from './createTestPage';
export { JestBrowserReporter, RESULTS_GLOBAL, FINISH_EVENT } from './reporter/JestBrowserReporter';
export { setupJestLiteGlobals, resetJestLiteGlobals } from './runner/globals';
export type {
    JestBrowserReporterOptions, TestPageOptions, ReporterTheme, ReporterEventMap,
    RunOptions, TestFilter, RunSummary, BlockedNavigation, StatusCounts, StatusFilter, TestInfo, TestResult, TestStatus,
} from './types';
export type {
    JestLiteGlobals, Describe, It, Each, Hook, TestBody, DoneCallback, Expect, Matchers, Jest, Mock, Unsupported,
} from './jestApi';
