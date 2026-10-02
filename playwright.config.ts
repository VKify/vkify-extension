import { defineConfig } from '@playwright/test';

// E2E прогоняет РЕАЛЬНУЮ собранную сборку в настоящем Chromium с загруженным
// расширением — ловит то, что юнит-тесты (моки chrome.*) не видят: загрузку
// бандлов, alias chrome→browser, монтирование попапа, доступ к storage.
// Требует `npm run build`: UI-fixtures проверяют dist/chrome и dist/firefox.
//
// Firefox-сборка UI проверяется в Chromium с mock API. Нативная загрузка
// Firefox-расширения потребует отдельного web-ext + RDP-харнесса.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  timeout: 30_000,
  expect: { timeout: 10_000 },
});
