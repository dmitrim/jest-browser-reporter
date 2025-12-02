# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2025-12-02
### Added
- Custom test timeout support: Added comprehensive timeout configuration with two approaches:
  - Per-test timeout: Set individual timeouts by passing a timeout value as the third argument
  - Global timeout configuration: Use jest.setTimeout() to set default timeout for multiple tests
Per-test timeout example:
```javascript
// Set a 10-second timeout for a specific async test
test('async operation with custom timeout', async () => {
    await new Promise(resolve => setTimeout(resolve, 7500));
}, 10000);
```

Global timeout configuration example:
```javascript
// Set global timeout for all tests in describe block
beforeAll(() => {
    jest.setTimeout(20 * 1000); // 20 seconds
});

describe('long-running operations', () => {
    test('first long test', async () => {
        await new Promise(resolve => setTimeout(resolve, 7500));
    });
    
    test('second long test', async () => {
        await new Promise(resolve => setTimeout(resolve, 15000));
    });
});
```

Priority order:
  - Individual test timeout (third argument) - highest priority
  - jest.setTimeout() value
  - Default timeout (5000ms) - lowest priority

	
## [1.0.1] - 2025-10-03
### Fixed
- Console logs cleared.

## [1.0.0] - 2025-09-28
### Added
- Test results now include formatted source code view
 
## [1.0.0-a3] - 2025-09-27
### Added
- Optional `testNameFilter?: string` parameter in `JestBrowserReporter.run` to allow running only tests matching a specific name.
- `.only` and `.skip` support for describe blocks
  - `describe.only()` now runs only the specified test suite
  - `describe.skip()` now properly skips the specified test suite
  - Maintains compatibility with existing `it.only()` and `it.skip()`

### Fixed
- Ensure asynchronous `before` hooks are properly awaited before running tests.
- Fix jestLite (test-runner): support `.skip/.only` with proper async hooks

## [1.0.0-a2] - 2025-09-26
### Added
- Added `setupJestLiteGlobals` utility to automatically assign Jest Lite functions (`describe`, `it`, `expect`, `beforeAll`, `afterAll`, etc.) to the global scope, enabling Jest-like test execution in browser or Node environments.

### Fixed
- jest-browser-reporter: fix template strings and improve filters/search stability
  - Fixed unterminated template string errors in generated HTML
  - Normalized attribute spacing to avoid parsing issues
  - Improved filter logic for 'all' / 'pass' / 'fail' states
  - Ensured live-search works consistently with filters and grouping
  - Cleaned up event delegation and debounce handling


## [1.0.0-a1] - 2025-09-25

### Added
- Initial internal release.