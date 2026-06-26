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

  function c_s(s: string, seed: string): string {
    const len = s.length;
    if (!len) return s;
    let st = Math.abs(parseInt(seed, 10) || 0);
    const arr = s.split('');
    const idx: number[] = new Array(len) as number[];
    for (let i = len - 1; i >= 0; i--) {
      st = (len * (i + 1) ^ st + i) % len;
      idx[i] = st;
    }
    for (let i = 1; i < len; i++) {
      const j = idx[len - 1 - i];
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
  }

  function c_i(s: string, arg: string, vkId: number): string {
    return c_s(s, String(vkId ^ (parseInt(arg, 10) || 0)));
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
    const extra = audioData[13];
    let key: string | null = null;
    if (typeof extra === 'string') {
      const first = extra.split('/')[0];
      if (/^[a-f0-9]{16,}$/i.test(first)) key = first;
    }
    return key ? `${ownerId}_${audioId}_${key}` : `${ownerId}_${audioId}`;
  }

  // ── Основная функция получения URL ────────────────────────────────────────

  async function resolveUrl(audioData: unknown[]): Promise<string | null> {
    const vkId = getVkId();

    // 1. Прямой URL в данных
    if (isValidUrl(audioData[2])) return audioData[2] as string;

    // 2. Обфусцированный URL — декодируем локально
    if (typeof audioData[2] === 'string' && audioData[2].includes('audio_api_unavailable')) {
      const decoded = decodeAudioUrl(audioData[2] as string, vkId);
      if (isValidUrl(decoded)) return decoded;
    }

    // 3. API-запрос через внутренний VK ajax
    const ajax = w.ajax ?? w.Ajax;
    if (!ajax?.post) return null;

    const token = buildToken(audioData);

    return new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 10000);

      ajax.post('al_audio.php', { act: 'reload_audios', audio_ids: token, al: 1 }, {
        onDone: (resp) => {
          clearTimeout(timer);
          try {
            let tuple: unknown;
            if (Array.isArray(resp)) {
              tuple = resp[0];
            } else {
              const r = resp as Record<string, unknown>;
              const payload = r['payload'] as [unknown, unknown[][]] | undefined;
              tuple = payload?.[1]?.[0]?.[0];
            }
            if (!Array.isArray(tuple) || !tuple[2]) { resolve(null); return; }
            let url = tuple[2] as string;
            if (typeof url === 'string' && url.includes('audio_api_unavailable')) {
              url = decodeAudioUrl(url, vkId);
            }
            resolve(isValidUrl(url) ? url : null);
          } catch {
            resolve(null);
          }
        },
        onFail: () => { clearTimeout(timer); resolve(null); },
      });
    });
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
      ajax.post('al_audio.php', params, {
        onDone: (resp) => { clearTimeout(timer); resolve(resp); },
        onFail: () => { clearTimeout(timer); resolve(null); },
      });
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
