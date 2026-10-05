/**
 * Entry-точка on-demand бандла `audio-encoder.js`. Инжектится background'ом
 * (chrome.scripting, world: ISOLATED) в тот же изолированный мир, где работает
 * content.js — при ПЕРВОМ скачивании аудио. Несёт hls.js + lamejs, поэтому эти
 * библиотеки не попадают в content.js на document_start (см. [[bundle-size-budgets]]).
 *
 * Публикует реализацию в `window.__vkifyAudioEncoder`; content-прокси
 * (music/encoder.ts) дожидается этого глобала и вызывает API напрямую (тот же
 * realm — колбэки/AbortSignal идут по ссылке). Идемпотентно: повторная инъекция
 * просто перезапишет тот же объект.
 */
import { fetchAndEncode, fetchOriginal } from './encoder-impl.js';
import type { AudioEncoderApi } from './encoder-api.js';
import { installExtApi } from '@/shared/ext-api.js';

// Firefox executeScript can expose fresh API globals in this script sandbox.
// Initialise this entry independently of the document_start content script.
installExtApi();

const api: AudioEncoderApi = { fetchAndEncode, fetchOriginal };
window.__vkifyAudioEncoder = api;
