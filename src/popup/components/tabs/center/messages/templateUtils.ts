import type { TemplateAttachment, HotkeyCombo } from '@/types/index.js';

/** Общие константы, типы и хелперы для «Шаблонов» (TemplatesBlock + TemplateEditor). */

export const DEFAULT_TEMPLATES_HOTKEY: HotkeyCombo = {
  ctrlKey: true, shiftKey: false, altKey: false, code: 'Space', label: 'Ctrl+Space',
};

export const TPL_NAME_MAX = 60;
export const TPL_TEXT_MAX = 2000;

// Лимиты вложений: файлы хранятся base64-строками в chrome.storage.local
// (квота 10 МБ на всё расширение, unlimitedStorage не запрашиваем), поэтому
// сознательно скромные.
export const ATTACH_MAX_FILES = 3;
export const ATTACH_MAX_BYTES = 1.5 * 1024 * 1024; // 1,5 МБ на файл

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
  if (n >= 1024)        return `${Math.round(n / 1024)} КБ`;
  return `${n} Б`;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

export const VARIABLES: { code: string; description: string }[] = [
  { code: '%first_name%',    description: 'Имя собеседника' },
  { code: '%last_name%',     description: 'Фамилия собеседника' },
  { code: '%my_first_name%', description: 'Ваше имя' },
  { code: '%my_last_name%',  description: 'Ваша фамилия' },
  { code: '%title%',         description: 'Название беседы (для групп)' },
  { code: '%peer_id%',       description: 'ID диалога (peer_id)' },
  { code: '%time%',          description: 'Текущее время' },
  { code: '%date%',          description: 'Текущая дата' },
  { code: '%br%',            description: 'Перенос строки' },
];

export function genId(): string {
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export interface EditingState {
  id: string | null; // null = creating new
  name: string;
  text: string;
  attachments: TemplateAttachment[];
}

export const BLANK_EDIT: EditingState = { id: null, name: '', text: '', attachments: [] };
