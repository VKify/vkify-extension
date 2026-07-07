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

const api: AudioEncoderApi = { fetchAndEncode, fetchOriginal };
window.__vkifyAudioEncoder = api;
