import { tupleArtwork } from '@/shared/music-artwork.js';

(function () {
  'use strict';

  type VKAjax = {
    post: (
      url: string,
      params: Record<string, unknown>,
      callbacks: { onDone: (resp: unknown) => void; onFail: () => void }
    ) => void;
  };

  const w = window as Window & {
    __vkifyAudioDl?: boolean;
    vk?: { id?: string | number };
    ajax?: VKAjax;
    Ajax?: VKAjax;
  };

  if (w.__vkifyAudioDl) return;
  w.__vkifyAudioDl = true;

  // ── VK URL декодер (audio_api_unavailable) ─────────────────────────────────

  const VK_ALPHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN0PQRSTUVWXYZO123456789+/=';
  const STD_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  function vkB64(input: string): string {
    let s = '';
    for (const c of input) {
      const i = VK_ALPHA.indexOf(c);
      s += i !== -1 ? STD_ALPHA[i] : c;
    }
    while (s.length % 4) s += '=';
    try { return atob(s); } catch { return ''; }
  }

  function c_v(s: string): string { return s.split('').reverse().join(''); }

  function c_r(s: string, delta: string): string {
    const d = parseInt(delta, 10) || 0;
    return s.split('').map(c => {
      const i = VK_ALPHA.indexOf(c);
      if (i === -1) return c;
      let n = i - d;
      while (n < 0) n += VK_ALPHA.length;
      return VK_ALPHA[n % VK_ALPHA.length];
    }).join('');
  }

  function c_s(s: string, seed: string | bigint): string {
    const len = s.length;
    if (!len) return s;
    const arr = s.split('');
    const idx: number[] = new Array(len) as number[];
    if (typeof seed === 'bigint') {
      let st = seed < 0n ? -seed : seed;
      const size = BigInt(len);
      for (let i = len - 1; i >= 0; i--) {
        st = (size * BigInt(i + 1) ^ st + BigInt(i)) % size;
        idx[i] = Number(st);
      }
    } else {
      let st = Math.abs(parseInt(seed, 10) || 0);
      for (let i = len - 1; i >= 0; i--) {
        st = (len * (i + 1) ^ st + i) % len;
        idx[i] = st;
      }
    }
    for (let i = 1; i < len; i++) {
      const j = idx[len - 1 - i];
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
  }

  function c_i(s: string, arg: string, vkId: number): string {
    return c_s(s, BigInt(vkId) ^ BigInt(parseInt(arg, 10) || 0));
  }

  function c_x(s: string, key: string): string {
    if (!key) return s;
    const k = key.charCodeAt(0);
    return s.split('').map(c => String.fromCharCode(c.charCodeAt(0) ^ k)).join('');
  }

  function decodeAudioUrl(url: string, vkId: number): string {
    if (!url || !url.includes('audio_api_unavailable')) return url;
    try {
      const m = url.match(/\?extra=([^#]+)(?:#(.*))?$/);
      if (!m) return url;
      let result = vkB64(m[1]);
      if (m[2]) {
        const ops = vkB64(m[2]);
        if (ops) {
          const list = ops.split('\x09');
          for (let i = list.length - 1; i >= 0; i--) {
            const op = list[i];
            if (!op) continue;
            const [cmd, arg] = op.split('\x0B');
            switch (cmd) {
              case 'v': result = c_v(result); break;
              case 'r': result = c_r(result, arg); break;
              case 's': result = c_s(result, arg); break;
              case 'i': result = c_i(result, arg, vkId); break;
              case 'x': result = c_x(result, arg); break;
            }
          }
        }
      }
      result = result.replace(/^[A-Z]ttps:/, 'https:');
      return result.startsWith('http') ? result : url;
    } catch {
      return url;
    }
  }

  // ── Вспомогательные функции ────────────────────────────────────────────────

  function getVkId(): number {
    if (w.vk?.id) return parseInt(String(w.vk.id), 10);
    const m = document.cookie.match(/remixmid=(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  }

  function isValidUrl(url: unknown): url is string {
    return (
      typeof url === 'string' &&
      url.startsWith('https://') &&
      !url.includes('audio_api_unavailable') &&
      url.length > 60
    );
  }

  function buildToken(audioData: unknown[]): string {
    const ownerId = audioData[1] as number;
    const audioId = audioData[0] as number;
    const hashes = typeof audioData[13] === 'string' ? audioData[13].split('/') : [];
    // VK uses actionHash and urlHash, not addHash (the first field).
    return hashes[2] && hashes[5] ? `${ownerId}_${audioId}_${hashes[2]}_${hashes[5]}` : '';
  }

  type TrackInfo = {
    trackId: string;
    title: string;
    performer: string;
    coverUrl: string;
    duration?: number;
    url: string;
    audioData: unknown[];
  };

  const trackCache = new Map<string, TrackInfo>();

  function looksLikeTrackTuple(value: unknown): value is unknown[] {
    return Array.isArray(value)
      && (typeof value[0] === 'number' || /^\d+$/.test(String(value[0] ?? '')))
      && (typeof value[1] === 'number' || /^-?\d+$/.test(String(value[1] ?? '')))
      && value.length > 4;
  }

  /** VK меняет обёртки ответа; ищем первый настоящий audio-кортеж. */
  function findTrackTuple(node: unknown, depth = 0): unknown[] | null {
    if (depth > 8 || node === null || typeof node !== 'object') return null;
    if (looksLikeTrackTuple(node)) return node;
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = findTrackTuple(child, depth + 1);
        if (found) return found;
      }
      return null;
    }
    for (const child of Object.values(node as Record<string, unknown>)) {
      const found = findTrackTuple(child, depth + 1);
      if (found) return found;
    }
    return null;
  }

  function tupleToTrackInfo(tuple: unknown[], fallbackId: string): TrackInfo | null {
    let url = typeof tuple[2] === 'string' ? tuple[2] : '';
    if (url.includes('audio_api_unavailable')) url = decodeAudioUrl(url, getVkId());
    if (!isValidUrl(url)) return null;
    const tupleId = `${String(tuple[1] ?? '')}_${String(tuple[0] ?? '')}`;
    const duration = Number(tuple[5]);
    return {
      trackId: /^-?\d+_\d+$/.test(tupleId) ? tupleId : fallbackId,
      title: String(tuple[3] ?? ''),
      performer: String(tuple[4] ?? ''),
      coverUrl: tupleArtwork(tuple),
      duration: Number.isFinite(duration) ? duration : undefined,
      url,
      audioData: tuple,
    };
  }

  async function getTrackInfo(trackId: string, accessKey?: string): Promise<TrackInfo | null> {
    if (!/^-?\d+_\d+$/.test(trackId)) return null;
    const cached = trackCache.get(trackId);
    if (cached) return cached;
    const ajax = w.ajax ?? w.Ajax;
    if (!ajax?.post) return null;
    const token = accessKey ? `${trackId}_${accessKey}` : trackId;
    const resp = await postAlAudio({ act: 'reload_audios', audio_ids: token, al: 1 });
    const tuple = findTrackTuple(resp);
    if (!tuple) return null;
    // reload_audios can return metadata and hashes with an empty URL.
    let info = tupleToTrackInfo(tuple, trackId);
    if (!info && buildToken(tuple)) {
      const url = await resolveUrl(tuple);
      if (url) info = tupleToTrackInfo([tuple[0], tuple[1], url, ...tuple.slice(3)], trackId);
    }
    if (info) {
      trackCache.set(trackId, info);
      trackCache.set(info.trackId, info);
    }
    return info;
  }

  // ── Основная функция получения URL ────────────────────────────────────────

  async function resolveUrl(audioData: unknown[]): Promise<string | null> {
    const readUrl = (tuple: unknown[]): string | null => {
      const url = typeof tuple[2] === 'string' ? decodeAudioUrl(tuple[2], getVkId()) : '';
      return isValidUrl(url) ? url : null;
    };
    const direct = readUrl(audioData);
    if (direct) return direct;

    let token = buildToken(audioData);
    if (!token) {
      const trackId = `${String(audioData[1])}_${String(audioData[0])}`;
      if (!/^-?\d+_\d+$/.test(trackId)) return null;
      const resp = await postAlAudio({ act: 'reload_audios', audio_ids: trackId, al: 1 });
      const tuple = findTrackTuple(resp);
      if (!tuple) return null;
      const url = readUrl(tuple);
      if (url) return url;
      token = buildToken(tuple);
    }
    if (!token) return null;
    // This is a separate endpoint: reload_audios refreshes metadata;
    // reload_audio resolves the stream using actionHash + urlHash.
    const resp = await postAlAudio({ act: 'reload_audio', ids: token, al: 1 });
    const tuple = findTrackTuple(resp);
    return tuple ? readUrl(tuple) : null;
  }

  // ── Слушатель запросов от content-скрипта ─────────────────────────────────

  window.addEventListener('vkify:audio:get-url', (e) => {
    const { requestId, audioData } = (e as CustomEvent<{ requestId: string; audioData: unknown[] }>).detail;
    void resolveUrl(audioData).then((url) => {
      window.dispatchEvent(new CustomEvent('vkify:audio:url-response', {
        detail: { requestId, url: url ?? '' },
      }));
    });
  });

  window.addEventListener('vkify:audio:get-track-info', (e) => {
    const { requestId, trackId, accessKey } = (e as CustomEvent<{
      requestId: string; trackId: string; accessKey?: string;
    }>).detail;
    void getTrackInfo(trackId, accessKey).then((info) => {
      window.dispatchEvent(new CustomEvent('vkify:audio:track-info-response', {
        detail: { requestId, info },
      }));
    });
  });

  // ── Полный список треков плейлиста/альбома через al_audio.php ──────────────

  /** Похоже ли значение на VK audio-кортеж ([id, owner, url, title, artist, …]). */
  function looksLikeAudio(a: unknown): a is unknown[] {
    return Array.isArray(a)
      && typeof a[0] === 'number' && typeof a[1] === 'number'
      && a.length > 5 && typeof a[3] === 'string' && typeof a[4] === 'string';
  }

  /** Рекурсивно ищет в ответе al_audio массив audio-кортежей. */
  function findAudioList(node: unknown, depth: number): unknown[][] | null {
    if (depth > 8 || node === null || typeof node !== 'object') return null;
    if (Array.isArray(node)) {
      if (node.length > 0 && node.every(looksLikeAudio)) return node as unknown[][];
      const audios = node.filter(looksLikeAudio);
      if (audios.length > 0 && audios.length >= node.length - 2) return audios;
      for (const el of node) {
        const r = findAudioList(el, depth + 1);
        if (r) return r;
      }
    } else {
      for (const k of Object.keys(node)) {
        const r = findAudioList((node as Record<string, unknown>)[k], depth + 1);
        if (r) return r;
      }
    }
    return null;
  }

  function postAlAudio(params: Record<string, unknown>): Promise<unknown> {
    const ajax = w.ajax ?? w.Ajax;
    if (!ajax?.post) return Promise.resolve(null);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 12000);
      try {
        ajax.post('al_audio.php', params, {
          onDone: (resp) => { clearTimeout(timer); resolve(resp); },
          onFail: () => { clearTimeout(timer); resolve(null); },
        });
      } catch {
        clearTimeout(timer);
        resolve(null);
      }
    });
  }

  async function loadPlaylist(ownerId: string, playlistId: string, accessHash: string): Promise<unknown[][]> {
    const all: unknown[][] = [];
    const seen = new Set<string>();
    let offset = 0;

    for (let page = 0; page < 60; page++) {
      const resp = await postAlAudio({
        act: 'load_section',
        owner_id: ownerId,
        playlist_id: playlistId,
        type: 'playlist',
        access_hash: accessHash || '',
        offset,
        count: 200,
        claim: 0,
        is_loading_all: 1,
        al: 1,
      });
      const list = findAudioList(resp, 0);
      if (!list || list.length === 0) break;

      let added = 0;
      for (const t of list) {
        const key = `${String(t[1])}_${String(t[0])}`;
        if (seen.has(key)) continue;
        seen.add(key);
        all.push(t);
        added++;
      }
      if (added === 0) break;
      offset = all.length;
      if (list.length < 100) break; // последняя страница
    }
    return all;
  }

  window.addEventListener('vkify:audio:get-playlist', (e) => {
    const { requestId, ownerId, playlistId, accessHash } =
      (e as CustomEvent<{ requestId: string; ownerId: string; playlistId: string; accessHash: string }>).detail;
    void loadPlaylist(ownerId, playlistId, accessHash).then((list) => {
      window.dispatchEvent(new CustomEvent('vkify:audio:playlist-response', {
        detail: { requestId, list },
      }));
    });
  });
})();
