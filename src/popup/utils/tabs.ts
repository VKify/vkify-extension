/**
 * Tab-операции для попапа/embed, маршрутизируемые через background.
 *
 * Почему через фон: popup, открытый как embed-iframe на vk.ru (см.
 * content/embed.ts), в Firefox является web-content-framed extension-страницей
 * и НЕ имеет собственного chrome.tabs (Firefox урезает API таких страниц).
 * Background же всегда обладает полным chrome.tabs, а сообщение доступно в обоих
 * контекстах. Так открытие/перезагрузка/опрос вкладок работают одинаково и в
 * обычном попапе, и в embed — без прямого обращения к chrome.tabs.
 */
import { sendMessage } from '../../shared/messaging.js';

/** Открыть URL в новой вкладке. */
export function openTab(url: string): void {
  void sendMessage({ type: 'OPEN_TAB', url });
}

/** Перезагрузить все открытые вкладки VK. */
export function reloadVKTabs(): void {
  void sendMessage({ type: 'RELOAD_VK_TABS' });
}

/** Перезагрузить активную вкладку, если это VK. Возвращает, была ли перезагрузка. */
export async function reloadActiveVKTab(): Promise<boolean> {
  try {
    const r = await sendMessage({ type: 'RELOAD_ACTIVE_VK_TAB' });
    return r?.reloaded ?? false;
  } catch {
    return false;
  }
}

/** Сколько вкладок VK открыто (опц. по конкретному URL-паттерну). */
export async function countVKTabs(urlPattern?: string): Promise<number> {
  try {
    const r = await sendMessage({ type: 'QUERY_VK_TABS', urlPattern });
    return r?.count ?? 0;
  } catch {
    return 0;
  }
}
