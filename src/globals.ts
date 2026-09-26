/**
 * Side-effect entry point `jest-browser-reporter/globals`: installs the test globals on import.
 *
 * ```js
 * import 'jest-browser-reporter/globals'; // first: installs describe, it, expect, …
 * import './tests/index.js';               // then the tests can use them
 * ```
 *
 * In TypeScript, it also declares the globals. Do not combine it with `@types/jest` in one
 * compilation: both declare `describe`, `it` and the rest.
 * @module
 */
import { setupJestLiteGlobals } from 'jest-browser-reporter';
import type { JestLiteGlobals } from './jestApi';

setupJestLiteGlobals();

declare global {
    const describe: JestLiteGlobals['describe'];
    const fdescribe: JestLiteGlobals['fdescribe'];
    const xdescribe: JestLiteGlobals['xdescribe'];
    const it: JestLiteGlobals['it'];
    const test: JestLiteGlobals['test'];
    const fit: JestLiteGlobals['fit'];
    const xit: JestLiteGlobals['xit'];
    const xtest: JestLiteGlobals['xtest'];
    const expect: JestLiteGlobals['expect'];
    const beforeAll: JestLiteGlobals['beforeAll'];
    const afterAll: JestLiteGlobals['afterAll'];
    const beforeEach: JestLiteGlobals['beforeEach'];
    const afterEach: JestLiteGlobals['afterEach'];
    const before: JestLiteGlobals['before'];
    const after: JestLiteGlobals['after'];
    const fail: JestLiteGlobals['fail'];
    const jest: JestLiteGlobals['jest'];
}
