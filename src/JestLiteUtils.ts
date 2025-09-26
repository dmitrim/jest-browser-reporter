/**
 * Setup Jest Lite functions as globals to run tests
 * in a Jest-like style (describe, it, expect, etc.).
 *
 * @param jestLite - The imported Jest Lite module (default export).
 */
export function setupJestLiteGlobals(jestLite: any): void {
    // Destructure core functions (keep originals)
    const {
        describe,
        it,
        expect,
        run: originalRun,
        beforeAll: originalBeforeAll,
        before: originalBefore,
        afterAll,
        beforeEach,
        afterEach,
        // other exports can be added if needed
    } = jestLite;

    // Arrays to track pending before-hook promises and the first encountered error
    const pendingBeforePromises: Promise<any>[] = [];
    let firstBeforeError: any = null;

    // Helper: register a noop hook with the original API to avoid double side-effects later
    function registerNoop(originalRegister: Function) {
        try {
            // register a no-op function so runner still sees a hook (if it relies on hooks count)
            originalRegister(() => undefined);
        } catch (e) {
            // some implementations may expect different signatures; ignore registration error
        }
    }

    // Wrap a before-like register function (before, beforeAll)
    function createBeforeWrapper(originalRegister?: Function) {
        if (!originalRegister) return undefined;

        return function (fn: Function) {
            registerNoop(originalRegister);
            try {
                const result = fn();
                if (result && typeof (result as any).then === "function") {
                    const p = (result as Promise<any>).catch(err => {
                        if (!firstBeforeError) {
                            firstBeforeError = err;
                            console.error("Error in before/beforeAll hook:", err);
                        }
                        throw err;
                    });
                    pendingBeforePromises.push(p);
                }
            } catch (err) {
                const p = Promise.reject(err);
                pendingBeforePromises.push(p.catch(() => { }));
                if (!firstBeforeError) firstBeforeError = err;
            }
        };
    }


    // Create wrappers for both `beforeAll` and `before` (some libs alias before->beforeAll)
    const wrappedBeforeAll = createBeforeWrapper(originalBeforeAll);
    const wrappedBefore = createBeforeWrapper(originalBefore || originalBeforeAll);

    // Replace jestLite registration functions with wrappers (if they exist)
    if (wrappedBeforeAll) jestLite.beforeAll = wrappedBeforeAll;
    if (wrappedBefore) jestLite.before = wrappedBefore;

    // Wrap run(): wait for all pending before-promises (if any) before calling original run
    jestLite.run = async function (...args: any[]) {
        if (pendingBeforePromises.length > 0) {
            // Wait for all before hooks to settle
            await Promise.allSettled(pendingBeforePromises);
        }
        return originalRun.apply(this, args);
    };

    // Expose globals as before (so tests can remain unchanged)
    (globalThis as any).describe = describe;
    (globalThis as any).it = it;
    (globalThis as any).expect = expect;
    // assign wrapped before/backwards aliases
    (globalThis as any).before = (globalThis as any).beforeAll = jestLite.beforeAll;
    (globalThis as any).after = (globalThis as any).afterAll = afterAll;
    (globalThis as any).beforeEach = beforeEach;
    (globalThis as any).afterEach = afterEach;

    (globalThis as any).run = jestLite.run;
}