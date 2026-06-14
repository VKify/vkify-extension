/**
 * Поиск и парсинг текста песни с Genius для ID3-тега. Фоновый fetch — без CORS;
 * парсим HTML без DOM (service worker без DOMParser). Любая ошибка → пустой
 * текст: фича опциональна, скачивание музыки от этого не ломается.
 */

function isGeniusUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && (u.hostname === 'genius.com' || u.hostname.endsWith('.genius.com'));
  } catch {
    return false;
  }
}

/**
 * Возвращает внутреннее содержимое каждого <div>, чей открывающий тег содержит
 * `marker`, корректно учитывая вложенные <div>.
 */
function extractBalancedDivs(html: string, marker: string): string[] {
  const out: string[] = [];
  let cursor = 0;

  for (;;) {
    const at = html.indexOf(marker, cursor);
    if (at === -1) break;
    const open = html.indexOf('>', at);
    if (open === -1) break;

    let depth = 1;
    let i = open + 1;
    const start = i;
    while (i < html.length && depth > 0) {
      const nextOpen  = html.indexOf('<div', i);
      const nextClose = html.indexOf('</div>', i);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        i = nextOpen + 4;
      } else {
        depth--;
        if (depth === 0) { out.push(html.slice(start, nextClose)); }
        i = nextClose + 6;
      }
    }
    cursor = i;
  }
  return out;
}

/**
 * Достаёт текст из HTML страницы Genius. Контейнеры `data-lyrics-container="true"`
 * содержат вложенные <div>, поэтому границы ищем балансировкой тегов, затем
 * чистим разметку и HTML-сущности.
 */
function extractGeniusLyrics(html: string): string {
  const blocks = extractBalancedDivs(html, 'data-lyrics-container="true"');
  if (blocks.length === 0) return '';

  return blocks.join('\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Ищет трек на Genius и возвращает текст песни (или '' при любой неудаче).
 * Сначала публичный search-эндпоинт (JSON), затем парсинг lyrics-контейнеров.
 */
export async function fetchGeniusLyrics(artist: string, title: string): Promise<string> {
  try {
    const q = encodeURIComponent(`${artist} ${title}`.trim());
    const searchResp = await fetch(`https://genius.com/api/search/multi?q=${q}`, {
      headers: { Accept: 'application/json' },
    });
    if (!searchResp.ok) return '';

    const json = await searchResp.json() as {
      response?: { sections?: Array<{ hits?: Array<{ type?: string; result?: { url?: string } }> }> };
    };
    const sections = json.response?.sections ?? [];
    let songUrl = '';
    for (const sec of sections) {
      const hit = (sec.hits ?? []).find(h => h.type === 'song' && h.result?.url);
      if (hit?.result?.url) { songUrl = hit.result.url; break; }
    }
    // URL приходит из ответа стороннего API — ходим только на genius.com,
    // иначе SSRF-подобный fetch произвольного адреса с правами background.
    if (!songUrl || !isGeniusUrl(songUrl)) return '';

    const pageResp = await fetch(songUrl);
    if (!pageResp.ok) return '';

    return extractGeniusLyrics(await pageResp.text());
  } catch {
    return '';
  }
}
