import { TestResults, TestResultsOptions } from './components/TestResults.js';

/**
 * Jest Browser Reporter - Main export
 */

/**
 * Initializes and returns a new TestResults instance
 * @param {Object} options - Configuration options
 * @returns {TestResults} TestResults instance
 */
export function createReporter(options: TestResultsOptions) {
    return new TestResults(options);
}

export { createReporter as JestBrowserReporter };

// Global registration for script tag usage
if (typeof window !== 'undefined') {
    (window as any).JestBrowserReporter = createReporter;
}