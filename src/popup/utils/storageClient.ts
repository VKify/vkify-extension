/**
 * Единственная точка доступа к `chrome.storage.local` для попап-UI.
 *
 * Компоненты (`src/popup/components/**`) НЕ трогают `chrome.storage.*` напрямую
 * — это запрещено ESLint-стражем. Причины:
 *   • один мок-поинт под тестами (не нужно мокать глобальный chrome в каждом);
 *   • в Firefox у embed-iframe попапа API может вести себя иначе — централизуем;
 *   • UI-настройки и так идут через SettingsContext/useStorage; здесь — доступ к
 *     НЕ-UI ключам (activity_*, stats_*, заметки, избранное), которых нет в
 *     React-state контекста (см. isNonUiStateKey в SettingsContext).
 *
 * Это тонкая обёртка, поведение 1-в-1 с прямыми вызовами — намеренно, чтобы
 * перевод компонентов был чистой индирекцией без изменения логики.
 */

import { migrator } from '@/shared/storage/Migrator.js';
import type { MigrationResult } from '@/shared/storage/Migrator.js';

/**
 * Привести storage к актуальной схеме (см. shared/storage/Migrator). Единая
 * точка запуска миграций из попапа — зовётся из `initStorageSync()` ДО первой
 * загрузки настроек. Конкуррентно-безопасно: делит общий промис с background.
 */
export function migrateStorage(): Promise<MigrationResult> {
  return migrator.migrate();
}

/** Прочитать ключ(и) из local-хранилища. По умолчанию — нетипизированный объект. */
export async function getStorage<T = Record<string, unknown>>(
  keys: string | readonly string[],
): Promise<T> {
  return (await chrome.storage.local.get(keys as string | string[])) as T;
}

/** Записать пачку ключей в local-хранилище. */
export async function setStorage(items: Record<string, unknown>): Promise<void> {
  await chrome.storage.local.set(items);
}

/**
 * Подписаться на изменения указанных ключей в local-хранилище.
 * Возвращает функцию отписки. Пустой `keys` — реагировать на любые изменения.
 * Колбэк получает только local-изменения (area уже отфильтрована).
 */
export function subscribeStorage(
  keys: readonly string[],
  cb: (changes: Record<string, chrome.storage.StorageChange>) => void,
): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ): void => {
    if (area !== 'local') return;
    if (keys.length === 0 || keys.some(k => k in changes)) cb(changes);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
