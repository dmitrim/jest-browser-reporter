# Quick start

The smallest useful setup: one call to `createTestPage()` and plain test files.

```bash
npm install
npm run dev
```

Open the printed URL and press **Run All** (or add `?autorun` to the URL).

- [`main.js`](main.js) creates the page. `tests` is a function, so the test files load only
  after `describe`, `it` and `expect` exist — no script order to get wrong.
- [`tests/`](tests) holds ordinary Jest-style tests; no imports needed.
