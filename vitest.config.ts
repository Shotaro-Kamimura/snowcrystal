import { defineConfig } from 'vitest/config';

// vite.config.ts は serve 時に root を playground へ切り替えるため、
// vitest には独立した設定を与える（こちらが優先される）。
export default defineConfig({
  test: {
    environment: 'node',
    // playground/annotations.test.ts は案 N の注記対応表テスト(設計書 §5 裁量 5 (a)。
    // playground 内で完結し src のテスト集合には影響しない)
    include: ['src/**/*.test.ts', 'playground/**/*.test.ts'],
  },
});
