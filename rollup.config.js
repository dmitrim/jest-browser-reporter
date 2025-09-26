import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import typescript from 'rollup-plugin-typescript2';
import del from 'rollup-plugin-delete';

import copy from "rollup-plugin-copy";
import fs from 'fs';
import path from 'path';

const isProd = process.env.NODE_ENV === 'production';

console.log(isProd ? "Production mode" : "Dev mode");

function getCopyTargets() {
	const copyTargets = [
          { 
            src: "README.md", 
            dest: "dist",
            rename: () => "README.md"
          },
          { 
            src: "docs/package_release.json", 
            dest: "dist",
            rename: () => "package.json"
          },
          { 
            src: "docs/CHANGELOG.md",
            dest: "dist",
            rename: () => "CHANGELOG.md"
          }		  
    ];	
	return copyTargets;
}


export default [
  // CommonJS
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/cjs/index.js',
      format: 'cjs',
      exports: 'named',
      sourcemap: !isProd
    },
    plugins: [
	  del({ targets: 'dist/*' }),
      nodeResolve(),
      commonjs(),
      typescript({ useTsconfigDeclarationDir: true }),
      isProd && terser(),
	  copy({
        targets: getCopyTargets(),
        hook: "writeBundle" // Copy after build
      })
    ]
  },
  // ES Module
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/esm/index.js',
      format: 'esm',
      sourcemap: !isProd
    },
    plugins: [
      nodeResolve(),
      commonjs(),
      typescript({ useTsconfigDeclarationDir: true }),
      isProd && terser()
    ]
  },
  // UMD
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/umd/index.js',
      format: 'umd',
      name: 'JestBrowserReporter',
      sourcemap: !isProd
    },
    plugins: [
      nodeResolve(),
      commonjs(),
      typescript({ useTsconfigDeclarationDir: true }),
      isProd && terser()
    ]
  }
];
