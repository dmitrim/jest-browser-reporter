# Features tour

One page that exercises everything the test API supports.

```bash
npm install
npm run dev
```

| File | Shows |
|---|---|
| [`main.js`](main.js) | Reporter options: title, back link, grouping, `theme: 'auto'`, `defaultTimeout` |
| [`tests/hooks.test.js`](tests/hooks.test.js) | `beforeAll` / `beforeEach` / `afterEach` / `afterAll`, async hooks, nesting |
| [`tests/modifiers.test.js`](tests/modifiers.test.js) | `.skip`, `.todo`, `describe.skip`; a note on `.only` |
| [`tests/each.test.js`](tests/each.test.js) | `it.each` with array and object rows, `describe.each` |
| [`tests/async.test.js`](tests/async.test.js) | `async` tests, `resolves` / `rejects`, `done` callback, per-test timeout |
| [`tests/mocks.test.js`](tests/mocks.test.js) | `jest.fn()`, `mockResolvedValue`, `jest.spyOn()`, asymmetric matchers |
| [`tests/failures.test.js`](tests/failures.test.js) | Two tests that **fail on purpose**, to show error details and "Run Failed" |

Things to try on the page: search (Ctrl+F), status filters, collapsing a group, **Stop** during
the run, **Run Failed**, **Export JSON** — then reload: filters, search and grouping are remembered.
