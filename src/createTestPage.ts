import type { TestPageOptions } from './types';
import { JestBrowserReporter, readUrlParams } from './reporter/JestBrowserReporter';
import { setupJestLiteGlobals } from './runner/globals';

/**
 * Sets up a complete test page in one call: installs the test globals, creates the reporter,
 * loads the test files and, if requested, starts a run.
 *
 * Because the globals are installed before `tests()` is called, the test files can use
 * `describe` / `it` / `expect` without imports — there is no script order to get wrong.
 *
 * @returns The reporter, once the tests are loaded. If loading fails, the error is shown
 * on the page and the promise rejects.
 *
 * @example
 * ```js
 * import { createTestPage } from 'jest-browser-reporter';
 *
 * createTestPage({
 *     container: '#root',
 *     title: 'My tests',
 *     tests: () => import('./tests/index.js'),
 * });
 * ```
 */
export async function createTestPage(options: TestPageOptions): Promise<JestBrowserReporter> {
    setupJestLiteGlobals();

    const { tests, autoRun, urlParams, ...reporterOptions } = options;
    const reporter = new JestBrowserReporter({ ...reporterOptions, autoRun: false, urlParams: false });

    try {
        await tests();
    } catch (error) {
        reporter.showNotice(`Failed to load the tests: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }

    const url = urlParams === false ? {} : readUrlParams();
    if (autoRun || url.autorun) {
        reporter.startAutoRun(autoRun === 'all' ? 'all' : 'filtered', url.grep);
    } else {
        reporter.refreshIdleState();
    }
    return reporter;
}
