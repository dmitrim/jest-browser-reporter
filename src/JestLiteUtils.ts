import jestLite from './jestLite';

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

    g.describe = describe;
    g.it = it;
    g.expect = expect;
    g.run = run;

    // Hooks
    g.beforeAll = beforeAll;
    g.afterAll = afterAll;
    g.beforeEach = beforeEach;
    g.afterEach = afterEach;

    // Use before if exists, otherwise alias to beforeAll
    g.before = before ?? beforeAll;

    // Alias after -> afterAll
    g.after = afterAll;
}
