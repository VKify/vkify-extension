/**
 * Лайв-превью цвета на активной VK-вкладке в обход chrome.storage.
 *
 * Запись в storage дебаунсится (см. useDebouncedCallback) — иначе контент-скрипт
 * перекрашивал бы тему на каждое промежуточное значение пипетки. Но из-за этого
 * страница обновлялась только после паузы. Чтобы вернуть реал-тайм (0ms), на
 * каждое движение шлём ENABLE_FEATURE со спец-featureId: background форвардит его
 * активной VK-вкладке (TabsHelper.sendToActiveVKTab), а контент применяет цвет
 * напрямую, без записи в хранилище. Финальный цвет всё равно сохранится
 * дебаунснутым путём.
 *
 * Поток сообщений коалесцируется по requestAnimationFrame: не больше одного
 * сообщения на фичу за кадр, и всегда с самым свежим цветом.
 */
import { sendMessage } from '@/shared/messaging.js';

export type PreviewFeature = 'custom_theme_preview' | 'custom_accent_preview';

let frame: number | null = null;
const pending = new Map<PreviewFeature, string>();

function flush(): void {
  frame = null;
  for (const [featureId, value] of pending) {
    void sendMessage({ type: 'ENABLE_FEATURE', featureId, value });
  }
  pending.clear();
}

/** Мгновенно показать `color` на странице VK (без записи в storage). */
export function previewColor(featureId: PreviewFeature, color: string): void {
  pending.set(featureId, color);
  if (frame === null) {
    frame = requestAnimationFrame(flush);
  }
}
