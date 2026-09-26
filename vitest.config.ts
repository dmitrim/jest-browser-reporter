import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: { 'jest-browser-reporter': path.resolve(__dirname, 'src/index.ts') },
    },
    test: {
        environment: 'happy-dom',
        include: ['tests/unit/**/*.test.ts'],
    },
});
