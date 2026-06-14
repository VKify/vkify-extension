import type { FeatureManager } from '../../../../core/feature-manager.js';
import { createMessageButtonFeature } from '../_shared/button-feature.js';
import { BTN_ATTR, STYLE_ID, BTN_CLASS } from './constants.js';
import { STYLE_CSS } from './styles.js';
import { makeButton } from './button.js';

/**
 * «Прикрепить как заметку»: рядом с кнопкой копирования — иконка-закладка, по
 * клику текст сообщения (плюс автор, время, peer_id и cmid чата) сохраняется в
 * локальный архив заметок (chrome.storage.local). Заметки смотрятся и правятся
 * во вкладке «Заметки» попапа. Никакой сети — всё локально.
 *
 * Жизненный цикл (стили/скан/observer/очистка) — в _shared/button-feature;
 * здесь — кнопка и регистрация. Извлечение источника — в peer/notes.
 */
export function registerPinNoteFeature(manager: FeatureManager): void {
  createMessageButtonFeature(manager, {
    settingKey: 'message_pin_notes',
    styleId: STYLE_ID,
    styleCss: STYLE_CSS,
    btnAttr: BTN_ATTR,
    btnClass: BTN_CLASS,
    logName: 'Pin notes',
    makeButton,
  });
}
