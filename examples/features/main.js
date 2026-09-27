import { createTestPage } from 'jest-browser-reporter';

createTestPage({
    container: '#app',
    title: 'Features tour',
    backLink: '../',
    groupBySuite: true,     // group rows by top-level describe (a saved choice wins)
    theme: 'auto',          // follow the OS light/dark setting
    defaultTimeout: 10000,  // same as jest.setTimeout(10000)
    tests: () => import('./tests/index.js'),
});
