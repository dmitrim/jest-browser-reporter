import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import typescript from 'rollup-plugin-typescript2';
import del from 'rollup-plugin-delete';
import copy from 'rollup-plugin-copy';
import postcss from 'rollup-plugin-postcss';

const isProd = process.env.NODE_ENV === 'production';
const sourcemap = !isProd;

console.log(isProd ? 'Production mode' : 'Dev mode');

const plugins = () => [
    nodeResolve(),
    commonjs(),
    typescript({ useTsconfigDeclarationDir: true }),
    postcss({ extensions: ['.css'], inject: true }),
    isProd && terser(),
];

export default [
    {
        input: 'src/index.ts',
        output: [
            { file: 'dist/cjs/index.js', format: 'cjs', exports: 'named', sourcemap },
            { file: 'dist/esm/index.js', format: 'esm', sourcemap },
            // Script-tag build: everything is on window.JestBrowserReporter
            { file: 'dist/umd/index.js', format: 'umd', name: 'JestBrowserReporter', exports: 'named', sourcemap },
        ],
        plugins: [
            del({ targets: 'dist/*' }),
            ...plugins(),
            copy({
                hook: 'writeBundle',
                targets: [
                    { src: 'README.md', dest: 'dist' },
                    { src: 'LICENSE', dest: 'dist' },
                    { src: 'docs/CHANGELOG.md', dest: 'dist' },
                    { src: 'docs/package_release.json', dest: 'dist', rename: 'package.json' },
                    { src: ['examples/*', '!**/node_modules', '!**/dist'], dest: 'dist/examples' },
                ],
            }),
        ],
    },
    {
        // `jest-browser-reporter/globals` reuses the main bundle instead of bundling a second
        // copy of jest-lite, which would have its own state and not see the registered tests.
        input: 'src/globals.ts',
        external: ['jest-browser-reporter'],
        output: [
            { file: 'dist/globals/index.js', format: 'esm', paths: { 'jest-browser-reporter': '../esm/index.js' } },
            { file: 'dist/globals/index.cjs', format: 'cjs', paths: { 'jest-browser-reporter': '../cjs/index.js' } },
        ],
        plugins: plugins(),
    },
];
