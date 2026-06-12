/** CSS оверлея-пикера шаблонов (светлая/тёмная тема). */

import { ROOT_ID } from './constants.js';

export const STYLE_CSS = `
    #${ROOT_ID} {
      position: fixed; z-index: 2147483646;
      display: none; flex-direction: column;
      width: 340px; max-height: 360px;
      background: #fff; color: #1d1d1f;
      border: 1px solid rgba(0,0,0,0.06);
      border-radius: 14px;
      box-shadow: 0 12px 36px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.06);
      font: 13px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      transform-origin: bottom left;
      animation: vkify-tpl-in .12s ease-out;
    }
    @keyframes vkify-tpl-in {
      from { opacity: 0; transform: translateY(4px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0)    scale(1);    }
    }
    #${ROOT_ID} .vkify-tpl-header {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px 8px;
      border-bottom: 1px solid rgba(0,0,0,0.05);
    }
    #${ROOT_ID} .vkify-tpl-header-icon {
      width: 24px; height: 24px; flex-shrink: 0;
      border-radius: 7px; background: linear-gradient(135deg, #0077ff, #0055cc);
      display: flex; align-items: center; justify-content: center; color: #fff;
      padding: 5px;
      box-shadow: 0 2px 8px rgba(0, 119, 255, 0.35);
    }
    #${ROOT_ID} .vkify-tpl-header-icon svg { width: 100%; height: 100%; }
    #${ROOT_ID} .vkify-tpl-header-close {
      width: 22px; height: 22px; flex-shrink: 0;
      border: none; background: transparent; cursor: pointer;
      border-radius: 6px; color: inherit; opacity: 0.5;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.1s ease, opacity 0.1s ease;
    }
    #${ROOT_ID} .vkify-tpl-header-close:hover {
      background: rgba(0, 0, 0, 0.06);
      opacity: 0.9;
    }
    #${ROOT_ID}.is-dark .vkify-tpl-header-close:hover {
      background: rgba(255, 255, 255, 0.08);
    }
    #${ROOT_ID} .vkify-tpl-header-title {
      flex: 1; font-size: 13px; font-weight: 600;
    }
    #${ROOT_ID} .vkify-tpl-header-hint {
      font-size: 11px; opacity: 0.5;
    }
    #${ROOT_ID} .vkify-tpl-list {
      flex: 1; min-height: 0; overflow-y: auto;
      padding: 4px;
    }
    #${ROOT_ID} .vkify-tpl-item {
      display: flex; flex-direction: column; gap: 2px;
      padding: 8px 10px;
      border-radius: 8px;
      cursor: pointer;
      user-select: none;
      transition: background 0.08s ease;
    }
    #${ROOT_ID} .vkify-tpl-item.is-active {
      background: rgba(0,119,255,0.10);
    }
    #${ROOT_ID} .vkify-tpl-item:hover {
      background: rgba(0,119,255,0.06);
    }
    #${ROOT_ID} .vkify-tpl-item.is-active:hover {
      background: rgba(0,119,255,0.14);
    }
    #${ROOT_ID} .vkify-tpl-name {
      font-weight: 600; font-size: 13px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #${ROOT_ID} .vkify-tpl-preview {
      font-size: 11px; opacity: 0.55;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #${ROOT_ID} .vkify-tpl-empty {
      padding: 22px 12px; text-align: center;
      font-size: 12px; opacity: 0.5;
    }
    #${ROOT_ID} .vkify-tpl-footer {
      display: flex; gap: 8px; flex-wrap: wrap;
      padding: 8px 14px;
      border-top: 1px solid rgba(0,0,0,0.05);
      font-size: 11px; opacity: 0.55;
    }
    #${ROOT_ID} .vkify-tpl-kbd {
      display: inline-flex; align-items: center; gap: 3px;
    }
    #${ROOT_ID} .vkify-tpl-kbd kbd {
      display: inline-block;
      padding: 1px 5px; font-size: 10px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      background: rgba(0,0,0,0.06);
      border: 1px solid rgba(0,0,0,0.08);
      border-radius: 4px; color: inherit;
    }
    #${ROOT_ID}.is-dark {
      background: #1c1c1e; color: #f5f5f7;
      border-color: rgba(255,255,255,0.08);
      box-shadow: 0 12px 36px rgba(0,0,0,0.42), 0 2px 6px rgba(0,0,0,0.2);
    }
    #${ROOT_ID}.is-dark .vkify-tpl-header,
    #${ROOT_ID}.is-dark .vkify-tpl-footer {
      border-color: rgba(255,255,255,0.06);
    }
    #${ROOT_ID}.is-dark .vkify-tpl-item.is-active {
      background: rgba(94,181,255,0.16);
    }
    #${ROOT_ID}.is-dark .vkify-tpl-item:hover {
      background: rgba(94,181,255,0.10);
    }
    #${ROOT_ID}.is-dark .vkify-tpl-kbd kbd {
      background: rgba(255,255,255,0.06);
      border-color: rgba(255,255,255,0.10);
    }
  `;
