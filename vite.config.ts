import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// In `serve` (npm run dev) we boot the playground viewer.
// In `build` we produce the ESM library only (three stays external / peerDep).
export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      root: 'playground',
    };
  }

  return {
    build: {
      lib: {
        entry: 'src/index.ts',
        formats: ['es'],
        fileName: () => 'index.js',
      },
      rollupOptions: {
        external: ['three'],
      },
      sourcemap: true,
    },
    plugins: [dts({ rollupTypes: true })],
  };
});
