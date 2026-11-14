import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  target: 'node18',
  platform: 'node',
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: false,
  keepNames: true,
  outExtension({ format }) {
    return { js: format === 'esm' ? '.mjs' : '.js' };
  },
});
