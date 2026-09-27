# Script tag

No bundler, no `npm install`: the UMD bundle is loaded from a CDN and the tests are plain scripts.

Open [`index.html`](index.html) in a browser — directly from disk works, or serve the folder
with any static server (`npx serve .`).

The UMD bundle exposes the whole API as `window.JestBrowserReporter`:

```js
JestBrowserReporter.setupJestLiteGlobals();          // before the test scripts
new JestBrowserReporter.JestBrowserReporter({ … });  // after them
```

To pin an exact version, replace `@2` in the CDN URL, e.g. `jest-browser-reporter@2.0.0`.
