import type { RunOptions, TestFilter, TestInfo } from '../types';

type TestPredicate = (test: TestInfo) => boolean;

/**
 * Combines the criteria of `options` into one predicate (all must match);
 * `undefined` when there are none.
 */
export function createTestPredicate(options: RunOptions, failedTests: readonly string[]): TestPredicate | undefined {
    const predicates: TestPredicate[] = [];
    if (options.filter !== undefined && options.filter !== '') predicates.push(fromFilter(options.filter));
    if (options.tests) predicates.push(inSet(options.tests));
    if (options.onlyFailed) predicates.push(inSet(failedTests));

    if (!predicates.length) return undefined;
    return test => predicates.every(p => p(test));
}

function fromFilter(filter: TestFilter): TestPredicate {
    if (typeof filter === 'function') return filter;
    if (filter instanceof RegExp) {
        return test => {
            filter.lastIndex = 0; // a /g or /y regexp is stateful
            return filter.test(test.fullName);
        };
    }
    return test => test.name.includes(filter) || test.suitePath.some(name => name.includes(filter));
}

function inSet(fullNames: readonly string[]): TestPredicate {
    const set = new Set(fullNames);
    return test => set.has(test.fullName);
}
