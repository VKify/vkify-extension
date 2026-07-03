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
 * Поток сообщений троттлится до ~60/с и коалесцируется: не больше одного
 * сообщения на фичу за интервал, всегда с самым свежим цветом. Жёсткая привязка
 * к rAF давала бы на 165-Гц мониторе 165 сообщений/с — лишний IPC и 165
 * пересчётов стиля всего VK-DOM в секунду. 60/с визуально неотличимы для цвета и
 * оставляют бюджет кадра самой странице.
 *
 * Применение всегда отложено (setTimeout), чтобы НЕСКОЛЬКО вызовов previewColor в
 * одном тике (фон + автоподобранный акцент) попали в ОДИН flush и применились
 * вместе — иначе акцент уезжал бы отдельным шагом с отставанием.
 */
import { sendMessage } from '@/shared/messaging.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { previewPopupTheme } from './themePalette.js';

export type PreviewFeature = 'custom_theme_preview' | 'custom_accent_preview';

const MIN_INTERVAL_MS = 16; // ≈60 применений/с

let timer: ReturnType<typeof setTimeout> | null = null;
let lastSent = 0;
const pending = new Map<PreviewFeature, string>();

function flush(): void {
  timer = null;
  lastSent = (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // Комбинируем превью фона и акцента: незатронутый канал берём из текущих
  // настроек. previewPopupTheme зовём ОДИН раз с парой (фон, акцент) — иначе при
  // перетаскивании фона акцент окна применялся бы отдельным шагом с отставанием.
  const s = useVKifyStore.getState().settings;
  let bg = (s['custom_theme'] as string | undefined) ?? null;
  let accent = (s['custom_accent'] as string | undefined) ?? null;

  for (const [featureId, value] of pending) {
    void sendMessage({ type: 'ENABLE_FEATURE', featureId, value }); // страница VK
    if (featureId === 'custom_theme_preview') bg = value;
    else accent = value;
  }
  previewPopupTheme(bg, accent); // окно расширения — единым применением
  pending.clear();
}

/** Мгновенно показать `color` на странице VK (без записи в storage). */
export function previewColor(featureId: PreviewFeature, color: string): void {
  pending.set(featureId, color);
  if (timer !== null) return; // flush уже запланирован — все каналы уедут вместе
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  // wait=0 — передний фронт (но через таймер, чтобы сгруппировать вызовы тика);
  // иначе — хвост: ждём, пока пройдёт минимальный интервал.
  const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastSent));
  timer = setTimeout(flush, wait);
}

// ── Live-preview числовых значений (слайдеры ширины/смещения) ────────────────
//
// Тот же принцип, что у цвета: на каждый тик слайдера шлём ENABLE_FEATURE с
// числом напрямую в контент (derivedCssPlugin трактует числовое value как
// override watch-ключа), а запись в storage дебаунсится на вызывающей стороне.
// Троттлинг и коалесинг отдельные от цветового канала — попапная тема тут не
// пересчитывается (previewPopupTheme не нужен).

let valueTimer: ReturnType<typeof setTimeout> | null = null;
let valueLastSent = 0;
const pendingValues = new Map<string, number>();

function flushValues(): void {
  valueTimer = null;
  valueLastSent = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  for (const [featureId, value] of pendingValues) {
    void sendMessage({ type: 'ENABLE_FEATURE', featureId, value }); // страница VK
  }
  pendingValues.clear();
}

/**
 * Мгновенно применить числовое значение фичи на странице VK (без записи в
 * storage). `featureId` — id derived-фичи (тоггла), значение уедет в override
 * её watch-ключа: previewFeatureValue('content_width_enabled', 1400).
 */
export function previewFeatureValue(featureId: string, value: number): void {
  pendingValues.set(featureId, value);
  if (valueTimer !== null) return;
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const wait = Math.max(0, MIN_INTERVAL_MS - (now - valueLastSent));
  valueTimer = setTimeout(flushValues, wait);
}
