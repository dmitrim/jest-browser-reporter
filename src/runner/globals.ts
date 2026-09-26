import jestLite from './jestLiteFixed';
import { TEST_TIMEOUT_KEY } from './runner';
import type { Describe, It, Jest, JestLiteGlobals, Unsupported } from '../jestApi';

type RegisterFn = (name: string, fn?: any, timeout?: number) => void;

const GLOBAL_NAMES: ReadonlyArray<keyof JestLiteGlobals | 'run'> = [
    'describe', 'fdescribe', 'xdescribe', 'it', 'test', 'fit', 'xit', 'xtest', 'expect',
    'beforeAll', 'afterAll', 'beforeEach', 'afterEach', 'before', 'after', 'fail', 'jest', 'run',
];

let installedGlobals: JestLiteGlobals | undefined;

/**
 * Installs `describe`, `it`, `test`, `expect`, the hooks, `jest` and the other Jest-style
 * globals on `globalThis`, so that test files can use them without imports.
 * It must run before the test files are evaluated; {@link createTestPage} and
 * `import 'jest-browser-reporter/globals'` take care of that.
 * Calling it again is harmless.
 */
export function setupJestLiteGlobals(): void {
    const globals = installedGlobals ??= createGlobals();
    const g = globalThis as unknown as Record<string, unknown>;
    Object.assign(g, globals);
    g.run = jestLite.run; // legacy: runs all tests and returns raw jest-lite results
}

/** Removes everything {@link setupJestLiteGlobals} installed. */
export function resetJestLiteGlobals(): void {
    const g = globalThis as unknown as Record<string, unknown>;
    GLOBAL_NAMES.forEach(name => delete g[name]);
}

function createGlobals(): JestLiteGlobals {
    const it = createIt(jestLite.it);
    const describe = createDescribe(jestLite.describe);
    const { beforeAll, afterAll, beforeEach, afterEach } = jestLite;

    return {
        describe,
        fdescribe: describe.only,
        xdescribe: describe.skip,
        it,
        test: it,
        fit: it.only,
        xit: it.skip,
        xtest: it.skip,
        expect: jestLite.expect,
        beforeAll,
        afterAll,
        beforeEach,
        afterEach,
        before: beforeAll,
        after: afterAll,
        fail: (message?: string): never => {
            throw new Error(message || 'Test failed explicitly');
        },
        jest: createJest(),
    };
}

function createIt(base: RegisterFn & { only: RegisterFn; skip: RegisterFn }): It {
    const variant = (register: RegisterFn) => Object.assign(
        (name: string, fn?: any, timeout?: number) => register(name, fn, timeout),
        { each: createEach(register) });

    return Object.assign(variant(base), {
        only: variant(base.only),
        skip: variant(base.skip),
        // A test without a body is registered as skipped.
        todo: (name: string) => base(`todo: ${name}`),
    });
}

function createDescribe(base: RegisterFn & { only: RegisterFn; skip: RegisterFn }): Describe {
    const variant = (register: RegisterFn) => Object.assign(
        (name: string, fn: () => void) => register(name, fn),
        { each: createEach(register) });

    return Object.assign(variant(base), { only: variant(base.only), skip: variant(base.skip) });
}

function createEach(register: RegisterFn) {
    return (table: readonly unknown[]) => {
        if (!Array.isArray(table)) {
            throw new Error('.each: only the array table form is supported, not the tagged template one');
        }
        return (name: string, fn: (...args: any[]) => any, timeout?: number) => {
            table.forEach((row, index) => {
                const args = Array.isArray(row) ? row : [row];
                register(formatEachTitle(name, args, index), () => fn(...args), timeout);
            });
        };
    };
}

/** Fills `printf`-style and `$property` placeholders of an `.each` title, as Jest does. */
export function formatEachTitle(title: string, args: readonly unknown[], index: number): string {
    let argIndex = 0;
    let result = title.replace(/%([sdifjoOp#%])/g, (match, flag: string) => {
        if (flag === '%') return '%';
        if (flag === '#') return String(index);
        if (argIndex >= args.length) return match;
        const value = args[argIndex++];
        switch (flag) {
            case 's': return String(value);
            case 'd':
            case 'i': return String(Math.trunc(Number(value)));
            case 'f': return String(Number(value));
            default: return stringify(value);
        }
    });

    const [first] = args;
    if (args.length === 1 && first !== null && typeof first === 'object' && !Array.isArray(first)) {
        result = result.replace(/\$([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/g, (match, path: string) => {
            let value: any = first;
            for (const key of path.split('.')) {
                if (value === null || value === undefined) return match;
                value = value[key];
            }
            return typeof value === 'string' ? value : stringify(value);
        });
    }
    return result;
}

function stringify(value: unknown): string {
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'function') return value.name ? `[Function ${value.name}]` : '[Function anonymous]';
    try {
        return JSON.stringify(value) ?? String(value);
    } catch {
        return String(value);
    }
}

/** jest-lite's jest-mock based mocker, plus `setTimeout`; everything else throws. */
function createJest(): Jest {
    const mocker = jestLite.jest;
    const unsupported = (name: string): Unsupported => () => {
        throw new Error(`jest.${name}() is not supported by jest-browser-reporter`);
    };

    const jest: Jest = {
        fn: implementation => mocker.fn(implementation),
        spyOn: (object, method) => mocker.spyOn(object, method),
        isMockFunction: (fn): fn is any => mocker.isMockFunction(fn),
        clearAllMocks: () => (mocker.clearAllMocks(), jest),
        resetAllMocks: () => (mocker.resetAllMocks(), jest),
        restoreAllMocks: () => (mocker.restoreAllMocks(), jest),
        setTimeout: timeout => {
            (globalThis as unknown as Record<string, unknown>)[TEST_TIMEOUT_KEY] = timeout;
            return jest;
        },
        mock: unsupported('mock'),
        unmock: unsupported('unmock'),
        doMock: unsupported('doMock'),
        requireActual: unsupported('requireActual'),
        useFakeTimers: unsupported('useFakeTimers'),
        useRealTimers: unsupported('useRealTimers'),
        advanceTimersByTime: unsupported('advanceTimersByTime'),
        runAllTimers: unsupported('runAllTimers'),
        retryTimes: unsupported('retryTimes'),
    };
    return jest;
}
