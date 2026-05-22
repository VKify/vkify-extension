import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: true,
  },
  // Mirror the build-time define so any module importing shared/constants/site.ts
  // gets the production URL under test (no ReferenceError on __VKIFY_SITE_URL__).
  define: {
    __VKIFY_SITE_URL__: JSON.stringify('https://vkify.ru'),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});