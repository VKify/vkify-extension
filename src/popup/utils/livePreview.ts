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
 * Поток сообщений троттлится до ~60/с (передний фронт + хвост) и коалесцируется:
 * не больше одного сообщения на фичу за интервал, всегда с самым свежим цветом.
 * Жёсткая привязка к rAF давала бы на 165-Гц мониторе 165 сообщений/с — лишний
 * IPC и 165 пересчётов стиля всего VK-DOM в секунду. 60/с визуально неотличимы
 * для цвета и оставляют бюджет кадра самой странице.
 */
import { sendMessage } from '@/shared/messaging.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { previewPopupTheme } from './themePalette.js';

export type PreviewFeature = 'custom_theme_preview' | 'custom_accent_preview';

const MIN_INTERVAL_MS = 16; // ≈60 применений/с

let timer: ReturnType<typeof setTimeout> | null = null;
let lastSent = 0;
const pending = new Map<PreviewFeature, string>();

/** Тем же значением, что летит на страницу VK, перекрашиваем и САМО окно. */
function applyPopupPreview(featureId: PreviewFeature, value: string): void {
  const s = useVKifyStore.getState().settings;
  if (featureId === 'custom_theme_preview') {
    previewPopupTheme(value, (s['custom_accent'] as string | undefined) ?? null);
  } else {
    previewPopupTheme((s['custom_theme'] as string | undefined) ?? null, value);
  }
}

function flush(): void {
  timer = null;
  lastSent = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  for (const [featureId, value] of pending) {
    void sendMessage({ type: 'ENABLE_FEATURE', featureId, value }); // страница VK
    applyPopupPreview(featureId, value);                            // окно расширения
  }
  pending.clear();
}

/** Мгновенно показать `color` на странице VK (без записи в storage). */
export function previewColor(featureId: PreviewFeature, color: string): void {
  pending.set(featureId, color);
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const elapsed = now - lastSent;
  if (elapsed >= MIN_INTERVAL_MS) {
    flush(); // передний фронт — применяем сразу
  } else if (timer === null) {
    timer = setTimeout(flush, MIN_INTERVAL_MS - elapsed); // хвост — досылаем последний цвет
  }
}
