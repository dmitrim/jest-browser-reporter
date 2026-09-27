// Type-checks the TypeScript example against the built package, resolved the way a consumer
// resolves it: node_modules/jest-browser-reporter -> dist (a temporary link).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dist = path.join(root, 'dist');
const link = path.join(root, 'node_modules', 'jest-browser-reporter');

if (!fs.existsSync(path.join(dist, 'types', 'index.d.ts'))) {
    console.error('dist/ is missing: run the build first');
    process.exit(1);
}

const created = !fs.existsSync(link);
if (created) fs.symlinkSync(dist, link, 'junction');
try {
    const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
    execFileSync(process.execPath, [tsc, '-p', path.join(root, 'examples', 'typescript')], { stdio: 'inherit' });
    console.log('examples/typescript: types OK');
} catch {
    process.exitCode = 1;
} finally {
    if (created) fs.rmSync(link, { recursive: false, force: true });
}
