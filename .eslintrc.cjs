// Минимальный ESLint: НЕ общий линтер стиля, а guardrails, машинно защищающие
// кросс-браузерные инварианты, на которых исторически спотыкались (см.
// CROSS_BROWSER.md). Никакого recommended-набора — только наши запреты, чтобы
// не создавать шума. AST-селекторы (no-restricted-syntax) игнорируют комментарии
// и строки — в отличие от grep, поэтому упоминания chrome.tabs в комментариях не
// ложно-срабатывают.
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  env: { browser: true, es2022: true, webextensions: true },
  ignorePatterns: ['dist', 'node_modules', 'coverage', '*.config.*', 'scripts', 'public'],
  rules: {
    // Глубокие относительные импорты (3+ уровня) хрупкие — ломаются при любом
    // перемещении файла (см. вынос Layout, бэклог #5). Паттерн '../../../**'
    // ловит ровно 3+ уровня (2-уровневые `../../` остаются — они стабильны).
    // Алиас '@/...' разрешается одинаково в tsc, vite (popup+classic) и vitest.
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['../../../**'],
        message: 'Глубокий относительный импорт (3+ уровня) хрупок. Используй алиас "@/..." (работает в tsc/vite/classic-сборке).',
      }],
    }],
  },
  overrides: [
    {
      // Попап (включая embed-iframe) НЕ должен трогать chrome.tabs напрямую —
      // в Firefox у web-content-framed extension-страницы его нет. И сообщения
      // в background — только через типобезопасный sendMessage.
      files: ['src/popup/**/*.ts', 'src/popup/**/*.tsx'],
      rules: {
        'no-restricted-syntax': ['error',
          {
            selector:
              "MemberExpression[property.name=/^(create|query|reload|sendMessage|remove|update)$/]" +
              "[object.object.name='chrome'][object.property.name='tabs']",
            message:
              'Не вызывай chrome.tabs.* напрямую из попапа — в Firefox embed-iframe его нет. ' +
              'Используй helpers из src/popup/utils/tabs.ts (они идут через background).',
          },
          {
            selector:
              "MemberExpression[property.name='sendMessage']" +
              "[object.object.name='chrome'][object.property.name='runtime']",
            message:
              'Используй типобезопасный sendMessage из src/shared/messaging.ts ' +
              'вместо сырого chrome.runtime.sendMessage (касты ответа = баги в рантайме).',
          },
        ],
      },
    },
    {
      // Компоненты попапа и feature-хуки НЕ трогают chrome.storage напрямую —
      // только через utils/storageClient.ts (getStorage/setStorage/subscribeStorage),
      // канонический store (@/shared/store) для settings-ключей, или owner-хуки
      // hooks/core. Даёт единый мок-поинт под тестами и изолирует возможные
      // различия Firefox embed-iframe. hooks/core и utils — намеренные владельцы
      // хранилища, поэтому под бан НЕ попадают. Намеренно `no-restricted-properties`,
      // а НЕ второй `no-restricted-syntax` — иначе он перезатёр бы chrome.tabs-бан
      // из попап-override выше (ESLint держит одну конфигурацию на правило).
      files: [
        'src/popup/components/**/*.ts',
        'src/popup/components/**/*.tsx',
        'src/popup/hooks/features/**/*.ts',
        'src/popup/hooks/features/**/*.tsx',
      ],
      rules: {
        'no-restricted-properties': ['error', {
          object: 'chrome',
          property: 'storage',
          message:
            'Не трогай chrome.storage.* напрямую из компонента/feature-хука — используй ' +
            'getStorage/setStorage/subscribeStorage из src/popup/utils/storageClient.ts, ' +
            'store (@/shared/store) для settings-ключей, или owner-хук из hooks/core.',
        }],
      },
    },
    {
      // content → injected (page-world) события должны идти через dispatchPageEvent
      // (cloneInto), иначе в Firefox detail не пересекает Xray-границу и фичи
      // молча не получают команд. Инжект-скрипты (page-world) и сам wrapper —
      // исключены: им cloneInto недоступен / не нужен.
      files: ['src/content/**/*.ts', 'src/content/**/*.tsx'],
      excludedFiles: ['src/content/utils/page-event.ts', 'src/content/injected/**'],
      rules: {
        'no-restricted-syntax': ['error',
          {
            selector:
              "CallExpression[callee.property.name='dispatchEvent']" +
              "[arguments.0.callee.name='CustomEvent']",
            message:
              'content→injected события теряют detail в Firefox (изоляция миров). ' +
              'Используй dispatchPageEvent из src/content/utils/page-event.ts (cloneInto), ' +
              'а не сырой dispatchEvent(new CustomEvent()).',
          },
        ],
      },
    },
  ],
};
