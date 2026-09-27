# Programmatic API

Drive the reporter from your own code: buttons in the toolbar call the API, and the log panel
is filled from reporter events.

```bash
npm install
npm run dev
```

| API | What it does |
|---|---|
| `reporter.run({ filter })` | `filter` is a string (test or describe name contains it), a `RegExp` (matches `"Suite › test"`), or a function of `{ name, suitePath, fullName }` |
| `reporter.run({ tests: [fullName, …] })` | Runs exactly these tests |
| `reporter.runFailed()` | Re-runs the tests that failed last time — remembered across reloads |
| `reporter.run({ signal })` | Any `AbortSignal` stops the run, e.g. `AbortSignal.timeout(ms)` |
| `reporter.stop()` | Stops after the running test; the rest are reported as cancelled |
| `reporter.on('runStart' \| 'testStart' \| 'testDone' \| 'runFinish', handler)` | Returns an unsubscribe function |
| `reporter.results`, `reporter.lastRun`, `reporter.failedTests`, `reporter.isRunning` | Read-only state |

"fails randomly" fails about half the time, so **Run Failed** has something to do.
