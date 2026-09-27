# TypeScript

Tests written in TypeScript, with the test globals typed by the package itself.

```bash
npm install
npm run dev        # Vite compiles the .ts files on the fly
npm run typecheck  # tsc --noEmit
```

- [`src/env.d.ts`](src/env.d.ts) references `jest-browser-reporter/globals`, which declares
  `describe`, `it`, `expect`, `jest` and the hooks exactly as jest-browser-reporter supports them.
  Do not add `@types/jest` to the same project: both declare the same globals.
- [`src/tests/cart.test.ts`](src/tests/cart.test.ts) uses typed `it.each` rows and a typed `jest.fn<T>()`.
