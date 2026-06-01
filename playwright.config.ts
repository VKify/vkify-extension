import { defineConfig } from '@playwright/test';

// E2E прогоняет РЕАЛЬНУЮ собранную сборку в настоящем Chromium с загруженным
// расширением — ловит то, что юнит-тесты (моки chrome.*) не видят: загрузку
// бандлов, alias chrome→browser, монтирование попапа, доступ к storage.
// Требует `npm run build:chrome` перед запуском (dist/chrome).
//
// Firefox-E2E не входит: загрузка расширений в Playwright Firefox не поддержана
// штатно (нужен отдельный web-ext + RDP-харнесс) — отдельный фронт работы.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },
});
