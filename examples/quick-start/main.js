import { createTestPage } from 'jest-browser-reporter';

// Installs describe/it/expect, renders the reporter, then loads the tests.
createTestPage({
    container: '#app',
    title: 'Quick start',
    tests: () => import('./tests/index.js'),
});
