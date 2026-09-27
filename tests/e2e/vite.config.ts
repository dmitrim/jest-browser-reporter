import path from 'node:path';
import { defineConfig } from 'vite';

// Serves the repository root, so both tests/e2e/pages and examples/ are reachable, with the
// package name mapped to the built bundles in dist/ — the same files that get published.
const root = path.resolve(__dirname, '../..');

export default defineConfig({
    root,
    logLevel: 'warn',
    resolve: {
        alias: [
            { find: /^jest-browser-reporter\/globals$/, replacement: path.join(root, 'dist/globals/index.js') },
            { find: /^jest-browser-reporter$/, replacement: path.join(root, 'dist/esm/index.js') },
        ],
    },
    optimizeDeps: { noDiscovery: true },
    server: { port: 4179, strictPort: true },
});
