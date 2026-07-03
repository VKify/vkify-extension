import type { FeatureManager } from '@/content/core/feature-manager.js';
import { createMessageButtonFeature } from '../_shared/button-feature.js';
import { BTN_ATTR, STYLE_ID, BTN_CLASS } from './constants.js';
import { STYLE_CSS } from './styles.js';
import { makeButton } from './button.js';
import { bulkAnchorActive, clearAnchor } from './bulk.js';

/**
 * Быстрое копирование сообщения: рядом со временем отправки в каждом
 * сообщении ВК — всегда видимая кнопка «копировать». Не зависит от hover и от
 * вида мессенджера (bubble / no-bubble).
 *
 * Если включена расшифровка VKify/COFFEE — копируется уже расшифрованный текст
 * (префиксы «☕ COFFEE:» / «🔐 E2E:» отбрасываются по title-атрибуту).
 * Shift+клик копирует диапазон сообщений (см. bulk.ts).
 *
 * Жизненный цикл (стили/скан/observer/очистка) — в _shared/button-feature;
 * здесь — кнопка, Esc-отмена диапазона и регистрация.
 */
export function registerQuickCopyFeature(manager: FeatureManager): void {
  let escHandler: ((e: KeyboardEvent) => void) | null = null;

  createMessageButtonFeature(manager, {
    settingKey: 'message_quick_copy',
    meta: {
      name: 'Быстрое копирование сообщений', category: 'messages', impact: 'medium',
      requiresDomLayer: true, tags: ['im', 'observer'],
    },
    styleId: STYLE_ID,
    styleCss: STYLE_CSS,
    btnAttr: BTN_ATTR,
    btnClass: BTN_CLASS,
    logName: 'Quick copy',
    makeButton,
    onEnable: () => {
      escHandler = (e) => { if (e.key === 'Escape' && bulkAnchorActive()) clearAnchor(); };
      window.addEventListener('keydown', escHandler);
    },
    onDisable: () => {
      if (escHandler) window.removeEventListener('keydown', escHandler);
      escHandler = null;
      clearAnchor();
    },
  });
}
