/** CSS кнопки «прикрепить как заметку» и состояния «сохранено». */

import { BTN_CLASS } from './constants.js';

export const STYLE_CSS = `
  .${BTN_CLASS} {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    margin-left: 4px;
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
    background: rgba(255, 152, 0, 0.18);
    color: #ff9800;
  }
  .${BTN_CLASS}:active { transform: scale(0.9); }
  .${BTN_CLASS}--done {
    background: rgba(255, 152, 0, 0.25) !important;
    color: #ff9800 !important;
  }
  .${BTN_CLASS} svg { width: 13px; height: 13px; pointer-events: none; }
`;
