/**
 * Types of the Jest-compatible globals installed by {@link setupJestLiteGlobals}
 * (and by importing `jest-browser-reporter/globals`). They describe what jest-lite
 * actually supports, which is a subset of Jest.
 * @module
 */

/** Callback form of an asynchronous test: call it when done, or pass it an error to fail. */
export type DoneCallback = (error?: unknown) => void;

/** Body of a test or hook: synchronous, returning a promise, or taking a {@link DoneCallback}. */
export type TestBody = (() => void | Promise<unknown>) | ((done: DoneCallback) => void);

/**
 * Parameterized variant of a test or describe function, as in Jest.
 *
 * Rows that are arrays are spread into the arguments; any other row is passed as the only argument.
 * The name may contain `printf`-style placeholders — `%s`, `%d`, `%i`, `%f`, `%j`, `%o`, `%p`, `%#`
 * (row index), `%%` — or, for object rows, `$property` / `$nested.property`.
 * The tagged template table form is not supported.
 *
 * @example
 * ```js
 * it.each([[1, 1, 2], [2, 3, 5]])('%i + %i = %i', (a, b, sum) => {
 *     expect(a + b).toBe(sum);
 * });
 * ```
 */
export interface Each<R> {
    /** Rows of arguments. */
    <T extends readonly unknown[]>(table: readonly T[]): (name: string, fn: (...args: T) => R, timeout?: number) => void;
    /** Rows passed as the single argument. */
    <T>(table: readonly T[]): (name: string, fn: (arg: T) => R, timeout?: number) => void;
}

/** `it()` / `test()`. */
export interface It {
    /**
     * Registers a test.
     * @param name - Test name, unique within its `describe`.
     * @param fn - Test body; a test without one is skipped.
     * @param timeout - Timeout in milliseconds; overrides `jest.setTimeout()`.
     */
    (name: string, fn?: TestBody, timeout?: number): void;
    /** Registers a focused test: while any exist, only focused tests run. */
    only: Omit<It, 'only' | 'skip' | 'todo'>;
    /** Registers a skipped test. */
    skip: Omit<It, 'only' | 'skip' | 'todo'>;
    /** Registers a placeholder for a test to be written; reported as skipped. */
    todo(name: string): void;
    /** Registers one test per table row. */
    each: Each<void | Promise<unknown>>;
}

/** `describe()`. */
export interface Describe {
    /** Groups tests; `fn` runs immediately and registers the tests and nested groups. */
    (name: string, fn: () => void): void;
    /** Registers a focused group: all its tests are focused. */
    only: Omit<Describe, 'only' | 'skip'>;
    /** Registers a skipped group. */
    skip: Omit<Describe, 'only' | 'skip'>;
    /** Registers one group per table row. */
    each: Each<void>;
}

/** `beforeAll()`, `afterEach()` and the other hooks. */
export type Hook = (fn: TestBody) => void;

/** Assertions available on `expect(value)`. */
export interface Matchers<R> {
    /** Inverts the following matcher. */
    not: Matchers<R>;
    /** Unwraps a fulfilled promise, then applies the following matcher. */
    resolves: Matchers<Promise<void>>;
    /** Unwraps a rejected promise's reason, then applies the following matcher. */
    rejects: Matchers<Promise<void>>;

    /** Checks `Object.is` equality. */
    toBe(expected: unknown): R;
    /** Checks recursive equality. */
    toEqual(expected: unknown): R;
    /** Checks that the value matches a subset of the properties of `expected`. */
    toMatchObject(expected: object | object[]): R;
    /** Checks that a number is equal to `expected` within `numDigits` decimal digits (default 2). */
    toBeCloseTo(expected: number, numDigits?: number): R;
    /** Checks `> expected`. */
    toBeGreaterThan(expected: number | bigint): R;
    /** Checks `>= expected`. */
    toBeGreaterThanOrEqual(expected: number | bigint): R;
    /** Checks `< expected`. */
    toBeLessThan(expected: number | bigint): R;
    /** Checks `<= expected`. */
    toBeLessThanOrEqual(expected: number | bigint): R;
    /** Checks that the value is not `undefined`. */
    toBeDefined(): R;
    /** Checks that the value is `undefined`. */
    toBeUndefined(): R;
    /** Checks that the value is `null`. */
    toBeNull(): R;
    /** Checks that the value is `NaN`. */
    toBeNaN(): R;
    /** Checks that the value is truthy. */
    toBeTruthy(): R;
    /** Checks that the value is falsy. */
    toBeFalsy(): R;
    /** Checks `instanceof`. */
    toBeInstanceOf(expected: Function): R;
    /** Checks that an array or string contains the item, using `===`. */
    toContain(expected: unknown): R;
    /** Checks that an array contains an item equal to `expected`. */
    toContainEqual(expected: unknown): R;
    /** Checks the `length` property. */
    toHaveLength(expected: number): R;
    /** Checks that the property at `path` exists, and optionally equals `value`. */
    toHaveProperty(path: string | readonly string[], value?: unknown): R;
    /** Checks that a string matches a regular expression or contains a substring. */
    toMatch(expected: string | RegExp): R;
    /** Checks that a function throws; optionally that the error matches `expected`. */
    toThrow(expected?: string | RegExp | Error | Function): R;
    /** Alias of {@link toThrow}. */
    toThrowError(expected?: string | RegExp | Error | Function): R;
    /** Checks that a mock function was called. */
    toHaveBeenCalled(): R;
    /** Checks how many times a mock function was called. */
    toHaveBeenCalledTimes(expected: number): R;
    /** Checks that a mock function was called with these arguments at least once. */
    toHaveBeenCalledWith(...args: unknown[]): R;
    /** Checks the arguments of the last call of a mock function. */
    toHaveBeenLastCalledWith(...args: unknown[]): R;
    /** Alias of {@link toHaveBeenCalled}. */
    toBeCalled(): R;
    /** Alias of {@link toHaveBeenCalledWith}. */
    toBeCalledWith(...args: unknown[]): R;
    /** Alias of {@link toHaveBeenLastCalledWith}. */
    lastCalledWith(...args: unknown[]): R;
}

/** `expect()` and its asymmetric matchers. */
export interface Expect {
    /** Starts an assertion about `actual`. */
    <T>(actual: T): Matchers<void>;
    /** Matches any value created by `constructor` (or of the matching primitive type). */
    any(constructor: Function): any;
    /** Matches anything except `null` and `undefined`. */
    anything(): any;
    /** Matches an array containing all the given items. */
    arrayContaining(items: readonly unknown[]): any;
    /** Matches an object having the given properties. */
    objectContaining(properties: object): any;
    /** Matches a string containing the substring. */
    stringContaining(substring: string): any;
    /** Matches a string matching the pattern. */
    stringMatching(pattern: string | RegExp): any;
    /** Checks that exactly `count` assertions are called during the test. */
    assertions(count: number): void;
    /** Checks that at least one assertion is called during the test. */
    hasAssertions(): void;
    /** Adds custom matchers. */
    extend(matchers: Record<string, (this: any, received: any, ...args: any[]) => { pass: boolean; message: () => string }>): void;
}

/**
 * A mock function created by `jest.fn()` or `jest.spyOn()`.
 * @typeParam T - Signature of the mocked function.
 */
export interface Mock<T extends (...args: any[]) => any = (...args: any[]) => any> {
    /** Calls the current implementation and records the call. */
    (...args: Parameters<T>): ReturnType<T>;
    /** Recorded calls. */
    mock: {
        /** Arguments of each call. */
        calls: Parameters<T>[];
        /** `this` of each call. */
        instances: unknown[];
        /** Outcome of each call. */
        results: Array<{
            /** Whether the call returned, threw, or has not finished yet. */
            type: 'return' | 'throw' | 'incomplete';
            /** The returned value or the thrown error. */
            value: unknown;
        }>;
    };
    /** Clears the recorded calls. */
    mockClear(): this;
    /** Clears the recorded calls and removes implementations and return values. */
    mockReset(): this;
    /** For a spy: puts the original method back. */
    mockRestore(): void;
    /** Sets the implementation. */
    mockImplementation(fn: T): this;
    /** Sets the implementation of the next call only. */
    mockImplementationOnce(fn: T): this;
    /** Makes every call return `value`. */
    mockReturnValue(value: ReturnType<T>): this;
    /** Makes the next call return `value`. */
    mockReturnValueOnce(value: ReturnType<T>): this;
    /** Makes every call return a promise resolving to `value`. */
    mockResolvedValue(value: Awaited<ReturnType<T>>): this;
    /** Makes the next call return a promise resolving to `value`. */
    mockResolvedValueOnce(value: Awaited<ReturnType<T>>): this;
    /** Makes every call return a promise rejected with `reason`. */
    mockRejectedValue(reason: unknown): this;
    /** Makes the next call return a promise rejected with `reason`. */
    mockRejectedValueOnce(reason: unknown): this;
    /** Makes every call return `this`. */
    mockReturnThis(): this;
    /** Sets the name shown in assertion messages. */
    mockName(name: string): this;
    /** The name set by {@link mockName}. */
    getMockName(): string;
    /** The current implementation. */
    getMockImplementation(): T | undefined;
}

/** A function that is not supported by jest-lite; calling it throws an error that says so. */
export type Unsupported = (...args: unknown[]) => never;

/** The `jest` object. */
export interface Jest {
    /**
     * Creates a mock function, optionally with an implementation.
     * @typeParam T - Signature of the mocked function.
     */
    fn<T extends (...args: any[]) => any = (...args: any[]) => any>(implementation?: T): Mock<T>;
    /** Replaces `object[method]` with a mock that calls the original method. */
    spyOn<O extends object, K extends keyof O>(object: O, method: K): O[K] extends (...args: any[]) => any ? Mock<O[K]> : never;
    /** Checks whether `fn` was created by {@link Jest.fn} or {@link Jest.spyOn}. */
    isMockFunction(fn: unknown): fn is Mock;
    /** Clears the recorded calls of all mocks. */
    clearAllMocks(): Jest;
    /** Resets all mocks, as {@link Mock.mockReset} does. */
    resetAllMocks(): Jest;
    /** Restores all spies, as {@link Mock.mockRestore} does. */
    restoreAllMocks(): Jest;
    /** Sets the default timeout in milliseconds for tests and hooks. */
    setTimeout(timeout: number): Jest;

    /** Not supported. */
    mock: Unsupported;
    /** Not supported. */
    unmock: Unsupported;
    /** Not supported. */
    doMock: Unsupported;
    /** Not supported. */
    requireActual: Unsupported;
    /** Not supported: real timers are always used. */
    useFakeTimers: Unsupported;
    /** Not supported: real timers are always used. */
    useRealTimers: Unsupported;
    /** Not supported: real timers are always used. */
    advanceTimersByTime: Unsupported;
    /** Not supported: real timers are always used. */
    runAllTimers: Unsupported;
    /** Not supported. */
    retryTimes: Unsupported;
}

/** Everything {@link setupJestLiteGlobals} puts on `globalThis`. */
export interface JestLiteGlobals {
    /** Groups tests. */
    describe: Describe;
    /** Alias of `describe.only`. */
    fdescribe: Describe['only'];
    /** Alias of `describe.skip`. */
    xdescribe: Describe['skip'];
    /** Registers a test. */
    it: It;
    /** Alias of {@link it}. */
    test: It;
    /** Alias of `it.only`. */
    fit: It['only'];
    /** Alias of `it.skip`. */
    xit: It['skip'];
    /** Alias of `it.skip`. */
    xtest: It['skip'];
    /** Starts an assertion. */
    expect: Expect;
    /** Runs once before all tests of the enclosing `describe`. */
    beforeAll: Hook;
    /** Runs once after all tests of the enclosing `describe`. */
    afterAll: Hook;
    /** Runs before each test of the enclosing `describe`. */
    beforeEach: Hook;
    /** Runs after each test of the enclosing `describe`. */
    afterEach: Hook;
    /** Alias of {@link beforeAll}. */
    before: Hook;
    /** Alias of {@link afterAll}. */
    after: Hook;
    /** Fails the current test. */
    fail(message?: string): never;
    /** Mocks and settings. */
    jest: Jest;
}
