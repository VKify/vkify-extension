/**
 * Языковой рантайм content-/injected-скриптов — БЕЗ словарей. Выделен из
 * index.ts, чтобы модули, которым нужен только текущий язык и подписка на его
 * смену (например, embed-мост с парой строк), могли тянуть этот рантайм без
 * полных словарей `ru.ts`/`en.ts`. `t()` и словари остались в index.ts.
 *
 * Язык = настройка `language` из chrome.storage (та же, что в попапе, см.
 * [[i18n-localization]]). Синхронно доступен на document_start через
 * localStorage-зеркало `vkify_lang` (тот же приём, что у темы —
 * appearance/theme/mirror.ts): `currentLang` читается из зеркала при загрузке
 * модуля, авторитетный reconcile из chrome.storage приезжает через несколько мс.
 */
import {
  DEFAULT_LANGUAGE,
  detectBrowserLanguage,
  isSupportedLanguage,
  type SupportedLanguage,
} from '../../locales/index.js';
import { dispatchPageEvent } from '../utils/page-event.js';

const MIRROR_KEY = 'vkify_lang';
/**
 * CustomEvent-мост content → MAIN-world. Инжектируемые скрипты (spy-agent и др.)
 * живут в page-world, где нет chrome.storage.onChanged: их `currentLang` замёрз
 * бы на загрузке. Content (авторитетный) на смене языка транслирует этот эвент,
 * а рантайм — импортируемый И в content, И в injected — слушает его и обновляет
 * язык на лету. См. utils/page-event.ts (кросс-браузерный dispatch).
 */
const LANG_EVENT = 'vkify:lang';

function readMirror(): SupportedLanguage {
  try {
    const v = localStorage.getItem(MIRROR_KEY);
    if (isSupportedLanguage(v)) return v;
  } catch {
    // localStorage недоступен — дефолт ниже
  }
  return DEFAULT_LANGUAGE;
}

function writeMirror(lang: SupportedLanguage): void {
  try {
    localStorage.setItem(MIRROR_KEY, lang);
  } catch {
    // quota / disabled — некритично
  }
}

let currentLang: SupportedLanguage = readMirror();

/** Текущий язык контента (для словарей, дат/`Intl` и т.п.). */
export function getLang(): SupportedLanguage {
  return currentLang;
}

type Listener = (lang: SupportedLanguage) => void;
const listeners = new Set<Listener>();

/**
 * Подписка на смену языка. Большинство инжектируемых элементов пересоздаётся
 * обсерверами при перерисовке страницы и подхватит новый язык само; долгоживущим
 * панелям (плеер, эквалайзер) стоит подписаться и перерендериться.
 * Возвращает функцию отписки.
 */
export function onLanguageChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Смена языка. `broadcast` шлёт CustomEvent в page-world (для injected-скриптов) —
 * ставится только авторитетным источником (content, из initI18n); слушатель
 * эвента, наоборот, вызывает без трансляции, чтобы не зациклиться.
 */
function setLang(lang: SupportedLanguage, broadcast = false): void {
  if (lang === currentLang) return;
  currentLang = lang;
  writeMirror(lang);
  if (broadcast) {
    try {
      dispatchPageEvent(LANG_EVENT, { lang });
    } catch {
      // page-world недоступен — injected-скрипты подхватят язык из зеркала на след. загрузке
    }
  }
  for (const cb of listeners) {
    try {
      cb(lang);
    } catch {
      // изолируем подписчиков друг от друга
    }
  }
}

// Приём языка из content в MAIN-world (и эхо собственной трансляции в content —
// setLang сам отсекает по `lang === currentLang`). Регистрируется на загрузке
// модуля в ЛЮБОМ мире, где рантайм импортируется (content + каждый injected-IIFE).
try {
  window.addEventListener(LANG_EVENT, (e: Event) => {
    const lang = (e as CustomEvent<{ lang?: unknown }>).detail?.lang;
    if (isSupportedLanguage(lang)) setLang(lang);
  });
} catch {
  // window недоступен (напр. worker/тест-окружение) — мост не нужен
}

let inited = false;

/**
 * Авторитетная инициализация из chrome.storage + подписка на изменения.
 * Вызывать один раз рано в content/index.ts (после installExtApi).
 */
export function initI18n(): void {
  if (inited) return;
  inited = true;
  try {
    void chrome.storage.local
      .get('language')
      .then((s) => {
        const lang = (s as { language?: unknown }).language;
        // Свежая установка: попап ещё не записал `language` → детект браузера
        // (то же поведение, что у попапа), иначе — сохранённый выбор.
        setLang(isSupportedLanguage(lang) ? lang : detectBrowserLanguage(), true);
        writeMirror(currentLang);
      })
      .catch(() => {
        // orphaned script — контекст умер, не мешаем странице
      });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.language) return;
      const nv = changes.language.newValue;
      if (isSupportedLanguage(nv)) setLang(nv, true);
    });
  } catch {
    // chrome.* недоступен — остаёмся на зеркальном языке
  }
}
