import { defineConfig } from 'vitest/config';

// vite.config.ts は serve 時に root を playground へ切り替えるため、
// vitest には独立した設定を与える（こちらが優先される）。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
