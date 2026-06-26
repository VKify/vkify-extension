/**
 * Мультизагрузка MP3 на странице /audios.
 *
 * Вставляет кнопку рядом с кнопкой AudioCatalogUploadAudioAction,
 * открывает пикер с multiple=true. Файлы загружаются последовательно через
 * audio.getUploadServer → fetch → audio.save с паузами между шагами, чтобы
 * не попасть в «Too many requests» / «Flood control» VK API.
 *
 * Кодировка: FormData получает ASCII-имя «audio.mp3», реальные artist/title
 * передаём через параметры audio.save (VK принимает их как UTF-8 JSON).
 *
 * Migrated to DOMObserver + selectors: якорь нативной кнопки загрузки —
 * SELECTORS.music.uploadVkBtn; ре-инжект идёт через ctx.observeChanges.
 */

import {
  createBrandButton, setBrandButtonLabel,
  downloadCenterJobStart as jobStart,
  downloadCenterJobUpdate as jobUpdate,
  downloadCenterJobDone as jobDone,
  downloadCenterJobError as jobError,
  ensureDownloadCenter,
} from '../_shared/index.js';
import { safeQuerySelector } from '@/content/core/dom/query.js';
import { SELECTORS } from '@/content/selectors/index.js';
import { getService, SERVICES } from '@/content/core/services/index.js';
import type { FeatureContext } from '@/content/core/feature-context.js';

const BTN_ATTR      = 'data-vkify-mupload';
const MAX_FILE_MB   = 200;
const DELAY_BETWEEN = 2000; // мс между файлами — защита от Flood control
const DELAY_SAVE    = 500;  // мс перед audio.save — защита от Too many requests

const delay = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

// ── VK API ───────────────────────────────────────────────────────────────────

// Единый VK API-сервис: in-page native-bridge → token-fallback. Раньше тут был
// round-trip в background (chrome.runtime.sendMessage VK_API_CALL) — content
// умеет звать VK сам, а сервис ещё и пэйсит/ретраит вызовы.
function callApi(method: string, params: Record<string, unknown>): Promise<unknown> {
  return getService(SERVICES.vkApi).call(method, params);
}

// ── Загрузка одного файла ─────────────────────────────────────────────────────

// jobId и nameNoExt создаются заранее (чтобы показать все треки в очереди сразу).
async function uploadSingleFile(
  file: File,
  jobId: string,
  nameNoExt: string,
  delaySave: number,
): Promise<void> {
  jobUpdate(jobId, 'Получение ссылки...');

  // 1. URL upload-сервера
  const serverData = await callApi('audio.getUploadServer', {}) as { upload_url?: string };
  const uploadUrl = serverData?.upload_url;
  if (!uploadUrl) {
    jobError(jobId, 'Не удалось получить URL загрузки');
    return;
  }

  jobUpdate(jobId, 'Загрузка файла...');

  // 2. POST на upload-сервер
  // ASCII-имя файла → исключаем кракозябры при обработке имени файла сервером VK.
  // Метаданные передаём отдельно в audio.save.
  const form = new FormData();
  form.append('file', file, 'audio.mp3');

  let uploadData: { server?: number; audio?: string; hash?: string };
  try {
    const uploadResp = await fetch(uploadUrl, { method: 'POST', body: form });
    if (!uploadResp.ok) throw new Error(`HTTP ${uploadResp.status}`);
    uploadData = await uploadResp.json() as typeof uploadData;
  } catch (fetchErr) {
    const msg = (fetchErr as Error).message;
    jobError(
      jobId,
      `Не удалось загрузить файл: ${msg}` +
      (msg.includes('Failed to fetch') ? ' (проверьте доступ к VK)' : ''),
    );
    return;
  }

  if (!uploadData?.audio) {
    jobError(jobId, 'Пустой ответ от VK upload-сервера');
    return;
  }

  jobUpdate(jobId, 'Сохранение трека...');

  // Пауза перед audio.save — снижает риск «Too many requests per second»
  await delay(delaySave);

  // 3. Разбираем «Исполнитель - Название» из имени файла (JS-строка — Unicode)
  const dashIdx = nameNoExt.indexOf(' - ');
  const artist = dashIdx > -1 ? nameNoExt.slice(0, dashIdx).trim() : '';
  const title  = dashIdx > -1 ? nameNoExt.slice(dashIdx + 3).trim() : nameNoExt;

  // 4. Сохраняем трек через API — audio.save принимает title/artist как UTF-8
  try {
    await callApi('audio.save', {
      server: uploadData.server,
      audio:  uploadData.audio,
      hash:   uploadData.hash,
      artist,
      title,
    });
  } catch (err) {
    jobError(jobId, (err as Error).message);
    return;
  }

  jobDone(jobId, artist ? `${artist} — ${title}` : title);
}

// ── Файловый пикер ────────────────────────────────────────────────────────────

let fileInput: HTMLInputElement | null = null;

function getOrCreateFileInput(btn: HTMLElement): HTMLInputElement {
  if (fileInput?.isConnected) return fileInput;

  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.mp3,audio/mpeg';
  inp.multiple = true;
  inp.style.display = 'none';
  document.body.appendChild(inp);

  inp.addEventListener('change', async () => {
    const files = Array.from(inp.files ?? []);
    inp.value = '';
    if (!files.length) return;

    ensureDownloadCenter();

    // Читаем задержки из настроек (пользователь может настраивать в попапе)
    const stored = await chrome.storage.local.get(['audio_upload_delay_between', 'audio_upload_delay_save']);
    const delayBetween = Math.max(DELAY_BETWEEN, Number(stored['audio_upload_delay_between']) || DELAY_BETWEEN);
    const delaySave    = Math.max(DELAY_SAVE,    Number(stored['audio_upload_delay_save'])    || DELAY_SAVE);

    // Разделяем файлы на валидные и слишком большие
    type QueueItem = { file: File; jobId: string; nameNoExt: string };
    const queue: QueueItem[] = [];

    for (const f of files) {
      const jobId     = `mupload_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const nameNoExt = f.name.replace(/\.mp3$/i, '');
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        jobStart(jobId, nameNoExt);
        jobError(jobId, `Файл превышает ${MAX_FILE_MB} МБ`);
      } else {
        queue.push({ file: f, jobId, nameNoExt });
      }
    }

    // Показываем все треки в очереди сразу — пользователь видит весь список
    for (const { jobId, nameNoExt } of queue) {
      jobStart(jobId, nameNoExt);
      jobUpdate(jobId, 'В очереди...');
    }

    // Загружаем последовательно с паузой между файлами
    for (let i = 0; i < queue.length; i++) {
      const { file, jobId, nameNoExt } = queue[i];
      await uploadSingleFile(file, jobId, nameNoExt, delaySave);
      if (i < queue.length - 1) await delay(delayBetween);
    }

    setBrandButtonLabel(btn, 'Загрузить несколько');
  });

  fileInput = inp;
  return inp;
}

// ── Кнопка VKify ──────────────────────────────────────────────────

function injectButton(): void {
  if (document.querySelector(`[${BTN_ATTR}]`)) return;

  // Кнопка загрузки VK есть только на своей странице — если её нет, не инжектируем.
  const uploadVkBtn = safeQuerySelector<HTMLElement>(SELECTORS.music.uploadVkBtn);
  if (!uploadVkBtn) return;

  const btn = createBrandButton('Загрузить несколько', 'VKify: загрузить сразу несколько MP3-файлов');
  btn.setAttribute(BTN_ATTR, '');
  // Компактный вид рядом с иконками 24px
  Object.assign(btn.style, { height: '28px', padding: '0 12px', borderRadius: '8px', alignSelf: 'center', boxShadow: 'none' });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    getOrCreateFileInput(btn).click();
  });

  // Тень кнопок обрезается overflow:hidden родителя — разрешаем выход за границы.
  const group = uploadVkBtn.parentElement;
  if (group) group.style.overflow = 'visible';

  // Всегда перед кнопкой VK «Загрузить аудиозапись» — стабильный якорь.
  // «Скачать всё» (data-vkify-adl-all) при наличии будет первым в группе,
  // наша кнопка — второй, VK-иконки — после.
  uploadVkBtn.before(btn);
}

// ── Экспортируемая фабрика фичи ───────────────────────────────────────────────

export function createAudioMultiUploadFeature(ctx: FeatureContext): import('@/types/index.js').FeatureMap {
  let off: (() => void) | null = null;

  return {
    audio_multi_upload: {
      reapplyOnNavigate: true,

      matchPath: (pathname: string) => /^\/audios/.test(pathname),

      enable: () => {
        injectButton();
        // Через manager (не domObserver напрямую) — чтобы время колбэка
        // относилось на runtime audio_multi_upload в Performance Dashboard.
        off?.();
        off = ctx.observeChanges('audio_multi_upload', () => {
          if (!document.querySelector(`[${BTN_ATTR}]`)) injectButton();
        });
      },

      disable: () => {
        off?.();
        off = null;
        document.querySelectorAll(`[${BTN_ATTR}]`).forEach(el => el.remove());
        fileInput?.remove();
        fileInput = null;
      },
    },
  };
}