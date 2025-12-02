import jestLite from './jestLiteFixed';

/**
 * Setup Jest Lite functions as globals to run tests
 * in a Jest-like style (describe, it, expect, etc.).
 */
export function setupJestLiteGlobals(): void {
    const {
        describe,
        it,
        expect,
        run,
        beforeAll,
        afterAll,
        beforeEach,
        afterEach,
        before, // may be undefined in some builds
    } = jestLite;

    const g = globalThis as unknown as Record<string, unknown>;

    // Test suite and case functions
    g.describe = describe;
    g.it = it;
    g.test = it; // Jest alias for it
    g.expect = expect;
    g.run = run;

    // Lifecycle hooks
    g.beforeAll = beforeAll;
    g.afterAll = afterAll;
    g.beforeEach = beforeEach;
    g.afterEach = afterEach;

    // Use before if exists, otherwise alias to beforeAll
    g.before = before ?? beforeAll;

    // Alias after -> afterAll
    g.after = afterAll;

    // Jest compatibility aliases
    g.fdescribe = describe.only; // Focused describe
    g.fit = it.only; // Focused it/test
    g.xdescribe = describe.skip; // Skipped describe
    g.xit = it.skip; // Skipped it/test
    g.xtest = it.skip; // Skipped test alias

    /**
     * Explicitly fail a test with optional message
     * @param message - Optional failure message
     * @throws Error with the provided message
     */
    g.fail = (message?: string) => {
        throw new Error(message || 'Test failed explicitly');
    };

    // Jest matcher utilities
    g.jest = {
        /**
         * Mock timer functions (not implemented - browser native timers are used)
         */
        useFakeTimers: () => console.warn('useFakeTimers not implemented in Jest Lite - using real browser timers'),
        useRealTimers: () => console.warn('useRealTimers not implemented in Jest Lite - real timers are always used'),

        /**
         * Create a mock function with basic tracking
         * @param implementation - Optional function implementation
         * @returns Mock function with mock property
         */
        fn: (implementation?: Function) => {
            console.warn('jest.fn not fully implemented in Jest Lite');
            const mockFn: any = implementation || (() => { });
            mockFn.mock = {
                calls: [],
                results: [],
                instances: [],
            };
            return mockFn;
        },

        /**
         * Mock module (not implemented)
         * @param moduleName - Name of module to mock
         */
        mock: (moduleName: string) => console.warn(`jest.mock not implemented for: ${moduleName}`),

        /**
         * Unmock module (not implemented)
         * @param moduleName - Name of module to unmock
         */
        unmock: (moduleName: string) => console.warn(`jest.unmock not implemented for: ${moduleName}`),

        /**
         * Advance fake timers (not implemented - using real timers)
         * @param ms - Milliseconds to advance
         */
        advanceTimersByTime: (ms: number) => console.warn('advanceTimersByTime not implemented - using real browser timers'),

        /**
         * Set retry attempts for a test (not implemented)
         * @param numRetries - Number of retry attempts
         */
        retryTimes: (numRetries: number) => console.warn(`retryTimes not implemented: ${numRetries}`),

        /**
         * Clear all mock calls (not implemented)
         */
        clearAllMocks: () => console.warn('clearAllMocks not implemented'),

        /**
         * Reset all mocks (not implemented)
         */
        resetAllMocks: () => console.warn('resetAllMocks not implemented'),

        /**
         * Restore all mocks (not implemented)
         */
        restoreAllMocks: () => console.warn('restoreAllMocks not implemented'),

        /**
         * Create a spy on object method (not implemented)
         * @param obj - Object to spy on
         * @param method - Method name to spy on
         * @returns Original method
         */
        spyOn: (obj: any, method: string) => {
            console.warn(`jest.spyOn not implemented for: ${method}`);
            return obj[method];
        },

        setTimeout: (val: number) => {
            (globalThis as any).__JESTLITE_TEST_TIMEOUT = val;
        }
    };

}

/**
 * Run all Jest Lite tests and return results
 * @returns Promise resolving to test results array
 */
export function runJestLite(): Promise<any> {
    return jestLite.run();
}

/**
 * Create a focused test suite (only run this describe block)
 * @param name - Suite name
 * @param fn - Suite implementation function
 */
export function fdescribe(name: string, fn: () => void): void {
    (globalThis as any).describe.only(name, fn);
}

/**
 * Create a focused test case (only run this test)
 * @param name - Test name
 * @param fn - Test implementation function
 * @param timeout - Optional timeout in milliseconds
 */
export function fit(name: string, fn?: () => void, timeout?: number): void {
    (globalThis as any).it.only(name, fn, timeout);
}

/**
 * Create a skipped test suite
 * @param name - Suite name
 * @param fn - Suite implementation function
 */
export function xdescribe(name: string, fn: () => void): void {
    (globalThis as any).describe.skip(name, fn);
}

/**
 * Create a skipped test case
 * @param name - Test name
 * @param fn - Test implementation function
 * @param timeout - Optional timeout in milliseconds
 */
export function xit(name: string, fn?: () => void, timeout?: number): void {
    (globalThis as any).it.skip(name, fn, timeout);
}

/**
 * Alias for xit - skipped test case
 * @param name - Test name
 * @param fn - Test implementation function
 * @param timeout - Optional timeout in milliseconds
 */
export function xtest(name: string, fn?: () => void, timeout?: number): void {
    (globalThis as any).it.skip(name, fn, timeout);
}

/**
 * Explicitly fail a test with optional message
 * @param message - Optional failure message
 * @throws Error with the provided message
 */
export function fail(message?: string): never {
    throw new Error(message || 'Test failed explicitly');
}

/**
 * Reset Jest Lite environment (useful for testing)
 */
export function resetJestLiteGlobals(): void {
    const g = globalThis as unknown as Record<string, unknown>;
    const globalsToRemove = [
        'describe', 'it', 'test', 'expect', 'run', 'fail',
        'beforeAll', 'afterAll', 'beforeEach', 'afterEach',
        'before', 'after', 'fdescribe', 'fit', 'xdescribe', 'xit', 'xtest', 'jest'
    ];

    globalsToRemove.forEach(globalName => {
        delete g[globalName];
    });
}

/**
 * Retry a test multiple times (Jest retry functionality - not implemented)
 * @param numRetries - Number of times to retry the test
 * @returns Decorator function for tests
 */
export function retryTimes(numRetries: number): MethodDecorator {
    console.warn(`retryTimes not implemented: ${numRetries}`);
    return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
        return descriptor;
    };
}