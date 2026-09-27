import { createTestPage } from 'jest-browser-reporter';

const logElement = document.getElementById('log');
const log = (text) => {
    logElement.textContent += text + '\n';
    logElement.scrollTop = logElement.scrollHeight;
};

createTestPage({
    container: '#app',
    persistSettings: false,
    tests: () => import('./tests.js'),
}).then(setUp);

function setUp(reporter) {
    // Events: follow the run from your own code.
    reporter.on('runStart', ({ testCount }) => log(`▶ run started: ${testCount} tests selected`));
    reporter.on('testDone', (result) => {
        if (!result.filteredOut) log(`  ${result.status.padEnd(6)} ${result.fullName} (${result.duration ?? '–'} ms)`);
    });
    reporter.on('runFinish', (summary) => {
        const { pass, fail, skip, cancel } = summary.counts;
        log(`■ finished in ${summary.durationMs} ms: ${pass} passed, ${fail} failed, ${skip} skipped, ${cancel} cancelled`
            + (summary.aborted ? ' (stopped)' : ''));
    });

    // run() resolves with a summary; it rejects if a run is already in progress.
    const run = (options) => reporter.run(options).catch((error) => log(`! ${error.message}`));

    const actions = {
        // A string matches test names and describe names.
        'run-math': () => run({ filter: 'Math' }),
        // A RegExp matches the full name: "Suite › test".
        'run-regexp': () => run({ filter: /slow/ }),
        // A function gets { name, suitePath, fullName }.
        'run-fn': () => run({ filter: (test) => test.suitePath.length > 1 }),
        'run-failed': () => reporter.runFailed().catch((error) => log(`! ${error.message}`)),
        // Any AbortSignal stops the run; the running test finishes, the rest are cancelled.
        'run-timeout': () => run({ signal: AbortSignal.timeout(1500) }),
        'stop': () => reporter.stop(),
    };

    for (const [id, action] of Object.entries(actions)) {
        document.getElementById(id).addEventListener('click', action);
    }

    log(`${reporter.failedTests.length} failed tests remembered from the last visit`);
}
