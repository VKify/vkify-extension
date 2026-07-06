/**
 * Каркас фичи «кнопка действия у каждого сообщения» (быстрое копирование,
 * заметки и т.п.). Берёт на себя одинаковый жизненный цикл: внедрение стилей,
 * первичный скан, MutationObserver на подгрузку истории, идемпотентная вставка
 * и полная очистка при выключении. Специфика фичи — только в `makeButton` и
 * необязательных хуках onEnable/onDisable.
 */

import type { FeatureManager } from '@/content/core/feature-manager.js';
import { handlerFeature, type HandlerFeatureOptions } from '@/content/core/features/index.js';
import { findTextEl, findInfoRow, findContentEl } from './message-dom.js';
import { SELECTORS } from '@/content/selectors/index.js';

export interface MessageButtonFeature {
  /** Ключ настройки в FeatureManager. */
  settingKey: string;
  /** Метадата фичи (имя, категория, impact…) — инлайн при регистрации. */
  meta?: Omit<HandlerFeatureOptions, 'id' | 'handler' | 'plugins'>;
  styleId: string;
  styleCss: string;
  /** data-атрибут «кнопка уже внедрена» (защита от дублей). */
  btnAttr: string;
  /** CSS-класс кнопки — по нему чистим при выключении. */
  btnClass: string;
  /** Имя для логов: `[VKify] <logName> enabled/disabled`. */
  logName: string;
  /** Создаёт кнопку для конкретного сообщения. */
  makeButton: (messageBlock: Element) => HTMLButtonElement;
  /** Доп. инициализация при включении (глобальные хендлеры и т.п.). */
  onEnable?: () => void;
  /** Доп. очистка при выключении. */
  onDisable?: () => void;
}

export function createMessageButtonFeature(manager: FeatureManager, cfg: MessageButtonFeature): void {
  let off: (() => void) | null = null;
  let styleEl: HTMLStyleElement | null = null;

  function injectInto(messageBlock: Element): void {
    if (messageBlock.hasAttribute(cfg.btnAttr)) return;
    if (!findTextEl(messageBlock)) return; // нет текста — системка, пропускаем

    const btn = cfg.makeButton(messageBlock);
    const infoRow = findInfoRow(messageBlock);
    if (infoRow) {
      infoRow.appendChild(btn);
    } else {
      // Фолбэк: после контейнера контента, чтобы кнопка всё равно появилась,
      // даже если разметка инфо-строки изменилась.
      findContentEl(messageBlock)?.appendChild(btn);
    }
    messageBlock.setAttribute(cfg.btnAttr, '1');
  }

  manager.registerDefinition(handlerFeature({
    id: cfg.settingKey,
    ...cfg.meta,
    reapplyOnLanguageChange: true,
    handler: {
      enable: () => {
        if (off) return;

        styleEl = document.createElement('style');
        styleEl.id = cfg.styleId;
        styleEl.textContent = cfg.styleCss;
        document.head.appendChild(styleEl);

        // initial-скан существующих сообщений + подписка на будущие. Общий
        // observer вызывает injectInto и на сам узел-сообщение, и на потомков;
        // дедупликация по seen-WeakSet заменяет ручной scanAll/.matches-разбор.
        off = manager.observeMatches(cfg.settingKey, SELECTORS.messages.block, injectInto);

        cfg.onEnable?.();
        console.log(`[VKify] ${cfg.logName} enabled`);
      },

      disable: () => {
        off?.();
        off = null;
        styleEl?.remove();
        styleEl = null;

        cfg.onDisable?.();

        document.querySelectorAll(`[${cfg.btnAttr}]`).forEach((el) => {
          el.removeAttribute(cfg.btnAttr);
          el.querySelectorAll(`.${cfg.btnClass}`).forEach(b => b.remove());
        });

        console.log(`[VKify] ${cfg.logName} disabled`);
      },
    },
  }));
}
