/** CSS кнопки копирования, состояний (done/anchor) и тоста. */

import { BTN_CLASS } from './constants.js';

export const STYLE_CSS = `
  .${BTN_CLASS} {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    margin-left: 6px;
    padding: 0;
    border: none;
    background: rgba(127, 127, 127, 0.12);
    border-radius: 5px;
    cursor: pointer;
    color: var(--vkui--color_icon_secondary, #6d7885);
    transition: background 0.12s ease, color 0.12s ease, transform 0.12s ease;
    vertical-align: middle;
    flex-shrink: 0;
  }
  .${BTN_CLASS}:hover {
    background: rgba(0, 119, 255, 0.16);
    color: #0077ff;
  }
  .${BTN_CLASS}:active { transform: scale(0.9); }
  .${BTN_CLASS}--done {
    background: rgba(76, 175, 80, 0.2) !important;
    color: #4caf50 !important;
  }
  .${BTN_CLASS}--anchor {
    background: rgba(255, 152, 0, 0.25) !important;
    color: #ff9800 !important;
    box-shadow: 0 0 0 1px rgba(255, 152, 0, 0.5);
  }
  .vkify-copy-toast {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: rgba(0,0,0,0.85); color: #fff;
    padding: 8px 14px; border-radius: 8px;
    font: 13px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    z-index: 2147483646;
    pointer-events: none;
    animation: vkify-copy-toast-in 0.18s ease-out, vkify-copy-toast-out 0.25s ease-in 1.5s forwards;
  }
  @keyframes vkify-copy-toast-in  { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }
  @keyframes vkify-copy-toast-out { to { opacity: 0; transform: translate(-50%, 8px); } }
  .${BTN_CLASS} svg {
    width: 13px; height: 13px; pointer-events: none;
  }
`;
