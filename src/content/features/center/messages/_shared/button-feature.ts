/**
 * Каркас фичи «кнопка действия у каждого сообщения» (быстрое копирование,
 * заметки и т.п.). Берёт на себя одинаковый жизненный цикл: внедрение стилей,
 * первичный скан, MutationObserver на подгрузку истории, идемпотентная вставка
 * и полная очистка при выключении. Специфика фичи — только в `makeButton` и
 * необязательных хуках onEnable/onDisable.
 */

import type { FeatureManager } from '../../../../core/feature-manager.js';
import { findTextEl, findInfoRow, findContentEl } from './message-dom.js';

const MESSAGE_BLOCK_SELECTOR = '.ConvoHistory__messageBlock';

export interface MessageButtonFeature {
  /** Ключ настройки в FeatureManager. */
  settingKey: string;
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
  let observer: MutationObserver | null = null;
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

  function scanAll(root: ParentNode = document): void {
    root.querySelectorAll(MESSAGE_BLOCK_SELECTOR).forEach(injectInto);
  }

  manager.register(cfg.settingKey, {
    enable: () => {
      if (observer) return;

      styleEl = document.createElement('style');
      styleEl.id = cfg.styleId;
      styleEl.textContent = cfg.styleCss;
      document.head.appendChild(styleEl);

      scanAll();

      observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (!(node instanceof Element)) continue;
            if (node.matches?.(MESSAGE_BLOCK_SELECTOR)) injectInto(node);
            else scanAll(node);
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      cfg.onEnable?.();
      console.log(`[VKify] ${cfg.logName} enabled`);
    },

    disable: () => {
      observer?.disconnect();
      observer = null;
      styleEl?.remove();
      styleEl = null;

      cfg.onDisable?.();

      document.querySelectorAll(`[${cfg.btnAttr}]`).forEach((el) => {
        el.removeAttribute(cfg.btnAttr);
        el.querySelectorAll(`.${cfg.btnClass}`).forEach(b => b.remove());
      });

      console.log(`[VKify] ${cfg.logName} disabled`);
    },
  });
}
