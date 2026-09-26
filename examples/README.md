# Examples

Each folder is a small standalone project. Copy it out (or run it in place from
`node_modules/jest-browser-reporter/examples/`), then:

```bash
npm install
npm run dev
```

| Example | Shows |
|---|---|
| [`quick-start`](quick-start) | The minimum: `createTestPage()` and two test files |
| [`typescript`](typescript) | TypeScript tests, typed globals without `@types/jest` |
| [`script-tag`](script-tag) | No build step: the UMD bundle from a CDN |
| [`features`](features) | Hooks, `.skip`, `.todo`, `.each`, timeouts, mocks, async tests, grouping, dark theme |
| [`programmatic-api`](programmatic-api) | `run({ filter })`, `runFailed()`, `stop()`, `AbortSignal`, events |
| [`ci-playwright`](ci-playwright) | Running the page headless in CI and failing the build on test failures |
