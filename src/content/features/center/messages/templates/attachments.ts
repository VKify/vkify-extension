/**
 * Вложения шаблона.
 *
 * Файлы прикрепляются через синтетический paste с файлами в clipboardData —
 * тот же путь, что и при вставке скриншота из буфера: VK сам поднимает свой
 * нативный механизм загрузки (фото → как фото, остальное → как документ), и
 * пользователь видит вложения в композере до отправки. Это сознательно
 * вместо messages.send + upload-серверов API: не нужен токен с правами на
 * загрузку, и отправка остаётся под контролем пользователя.
 */

import type { TemplateAttachment } from '../../../../../types/index.js';

function attachmentToFile(att: TemplateAttachment): File | null {
  const m = att.dataUrl.match(/^data:([^;,]*)(;base64)?,(.*)$/);
  if (!m) return null;
  try {
    const mime = att.type || m[1] || 'application/octet-stream';
    // Явный Uint8Array<ArrayBuffer>: BlobPart не принимает ArrayBufferLike
    // (TextEncoder.encode типизирован шире — копируем в свежий буфер).
    let bytes: Uint8Array<ArrayBuffer>;
    if (m[2]) {
      const bin = atob(m[3]);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else {
      bytes = new Uint8Array(new TextEncoder().encode(decodeURIComponent(m[3])));
    }
    return new File([bytes], att.name || 'file', { type: mime });
  } catch {
    return null;
  }
}

export function attachFilesToInput(target: HTMLElement, attachments: TemplateAttachment[]): void {
  const dt = new DataTransfer();
  for (const att of attachments) {
    const file = attachmentToFile(att);
    if (file) dt.items.add(file);
  }
  if (dt.files.length === 0) return;

  target.focus();
  target.dispatchEvent(new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    clipboardData: dt,
  }));
}
