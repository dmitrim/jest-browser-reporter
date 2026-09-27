import { createTestPage, type RunSummary } from 'jest-browser-reporter';

createTestPage({
    container: '#app',
    title: 'TypeScript example',
    tests: () => import('./tests'),
}).then(reporter => {
    reporter.on('runFinish', (summary: RunSummary) => {
        console.log(`Finished in ${summary.durationMs} ms`, summary.counts);
    });
});
