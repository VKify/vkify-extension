import type { FeatureManager } from '@/content/core/feature-manager.js';
import {
  derivedCssFeature, handlerFeature, type FeatureDefinition,
} from '@/content/core/features/index.js';
import { isSafeFontFamily } from '@/shared/constants/settings-schema.js';

const GOOGLE_FONTS_API = 'https://fonts.googleapis.com/css2';
const FONT_LINK_ID = 'vkify-google-font';
// Mirror of the active Google-font <link> href, so the stylesheet starts loading
// synchronously at document_start (см. applyFontLinkFromMirror) — без него глифы
// шрифта подгружались бы только после init и заметно «доезжали».
const FONT_LINK_MIRROR_KEY = 'vkify:font-link';

const FONTS_CONFIG: Record<string, string> = {
  'inter': 'Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
  'manrope': 'Manrope:wght@300;400;500;600;700;800',
  'outfit': 'Outfit:wght@300;400;500;600;700',
  'plus-jakarta': 'Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
  'space-grotesk': 'Space+Grotesk:wght@300;400;500;600;700',
  'sora': 'Sora:wght@300;400;500;600;700',
  'urbanist': 'Urbanist:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
  'dm-sans': 'DM+Sans:ital,wght@0,400;0,500;0,700;1,400;1,500;1,700',
  'roboto': 'Roboto:ital,wght@0,300;0,400;0,500;0,700;1,300;1,400;1,500;1,700',
  'open-sans': 'Open+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
  'lato': 'Lato:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700;1,900',
  'montserrat': 'Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
  'poppins': 'Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
  'nunito': 'Nunito:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
  'raleway': 'Raleway:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
  'rubik': 'Rubik:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
  'ubuntu': 'Ubuntu:ital,wght@0,300;0,400;0,500;0,700;1,300;1,400;1,500;1,700',
  'source-sans': 'Source+Sans+3:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
  'bebas-neue': 'Bebas+Neue',
  'oswald': 'Oswald:wght@300;400;500;600;700',
  'righteous': 'Righteous',
  'fredoka': 'Fredoka:wght@300;400;500;600;700',
  'comfortaa': 'Comfortaa:wght@300;400;500;600;700',
  'quicksand': 'Quicksand:wght@300;400;500;600;700',
  'pacifico': 'Pacifico',
  'satisfy': 'Satisfy',
  'lobster': 'Lobster',
  'permanent-marker': 'Permanent+Marker',
  'caveat': 'Caveat:wght@400;500;600;700',
  'dancing-script': 'Dancing+Script:wght@400;500;600;700',
  'jost': 'Jost:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
  'josefin-sans': 'Josefin+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
  'exo-2': 'Exo+2:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
  'orbitron': 'Orbitron:wght@400;500;600;700;800;900',
  'rajdhani': 'Rajdhani:wght@300;400;500;600;700',
  'merriweather': 'Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700;1,900',
  'playfair': 'Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700',
  'lora': 'Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700',
  'pt-serif': 'PT+Serif:ital,wght@0,400;0,700;1,400;1,700',
  'eb-garamond': 'EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700',
  'cormorant': 'Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
  'crimson-pro': 'Crimson+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
  'libre-baskerville': 'Libre+Baskerville:ital,wght@0,400;0,700;1,400',
  'spectral': 'Spectral:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
  'bitter': 'Bitter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
  'jetbrains-mono': 'JetBrains+Mono:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
  'fira-code': 'Fira+Code:wght@300;400;500;600;700',
  'source-code-pro': 'Source+Code+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
  'roboto-mono': 'Roboto+Mono:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
  'ubuntu-mono': 'Ubuntu+Mono:ital,wght@0,400;0,700;1,400;1,700',
  'space-mono': 'Space+Mono:ital,wght@0,400;0,700;1,400;1,700',
  'ibm-plex-mono': 'IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
  'pt-sans': 'PT+Sans:ital,wght@0,400;0,700;1,400;1,700',
  'pt-mono': 'PT+Mono',
  'alice': 'Alice',
  'bad-script': 'Bad+Script',
  'marck-script': 'Marck+Script',
  'ruslan-display': 'Ruslan+Display',
  'kelly-slab': 'Kelly+Slab',
  'podkova': 'Podkova:wght@400;500;600;700;800',
  'atkinson': 'Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400;1,700',
  'lexend': 'Lexend:wght@300;400;500;600;700',
};

const VALID_FONT_STYLES      = new Set(['normal', 'italic', 'oblique']);
const VALID_TEXT_DECORATIONS = new Set(['none', 'underline', 'overline', 'line-through']);
const VALID_TEXT_TRANSFORMS  = new Set(['none', 'capitalize', 'uppercase', 'lowercase']);

const TEXT_SELECTORS = `
  [data-vkify-TEXT],
  [data-vkify-TEXT] body,
  [data-vkify-TEXT] p,
  [data-vkify-TEXT] span,
  [data-vkify-TEXT] div,
  [data-vkify-TEXT] .wall_post_text,
  [data-vkify-TEXT] .wall_text,
  [data-vkify-TEXT] .post_text,
  [data-vkify-TEXT] .im_msg_text,
  [data-vkify-TEXT] .im-mess--text,
  [data-vkify-TEXT] .reply_text,
  [data-vkify-TEXT] .comment_text,
  [data-vkify-TEXT] [class*="vkuiText"],
  [data-vkify-TEXT] [class*="Text--"],
  [data-vkify-TEXT] [class*="vkuiParagraph"]
`;

function isAllowedFontStylesheet(href: string): boolean {
  return Object.values(FONTS_CONFIG).some(
    (query) => href === `${GOOGLE_FONTS_API}?family=${query}&display=swap`,
  );
}

function injectFontLink(href: string): boolean {
  document.getElementById(FONT_LINK_ID)?.remove();
  if (!isAllowedFontStylesheet(href)) return false;

  const link = document.createElement('link');
  link.id = FONT_LINK_ID;
  link.rel = 'stylesheet';
  link.href = href;
  (document.head ?? document.documentElement).appendChild(link);
  return true;
}

function loadGoogleFont(fontQuery: string) {
  const href = `${GOOGLE_FONTS_API}?family=${fontQuery}&display=swap`;
  injectFontLink(href);
  try { localStorage.setItem(FONT_LINK_MIRROR_KEY, href); } catch { /* non-fatal */ }
}

function unloadGoogleFont() {
  document.getElementById(FONT_LINK_ID)?.remove();
  try { localStorage.removeItem(FONT_LINK_MIRROR_KEY); } catch { /* non-fatal */ }
}

/**
 * Synchronously re-attach the mirrored Google-font <link> at document_start so the
 * font file starts downloading before first paint. Called from content/index.ts.
 */
export function applyFontLinkFromMirror(): void {
  try {
    const href = localStorage.getItem(FONT_LINK_MIRROR_KEY);
    if (href && !injectFontLink(href)) {
      localStorage.removeItem(FONT_LINK_MIRROR_KEY);
    }
  } catch { /* corrupt / disabled storage — reconcile heals it */ }
}

/**
 * Значение-ключ → правило (derivedCssFeature): compute отдаёт готовый CSS,
 * механика (маркер, инжект, teardown, мягкий reapplyOnUpdate без кадра-сброса)
 * — в derivedCssPlugin. `marker` сохраняет исторические имена data-vkify-*.
 */
function textStyleFeature(opts: {
  id: string;
  name: string;
  marker: string;
  compute: (value: unknown) => string | null;
}): FeatureDefinition {
  return derivedCssFeature({
    id: opts.id,
    name: opts.name,
    category: 'appearance',
    marker: opts.marker,
    reapplyOnUpdate: true,
    tags: ['font'],
    compute: (settings) => {
      const css = opts.compute(settings[opts.id]);
      return css ? { css } : null;
    },
  });
}

/** Все фичи шрифта — декларативные определения, регистрируются appearance/index.ts. */
export function createFontFeatures(manager: FeatureManager): readonly FeatureDefinition[] {
  return [
    // Семейство шрифта: Google Fonts <link> + CSS-переменная. Императивное ядро
    // (загрузка/выгрузка внешнего шрифта, localStorage-зеркало ссылки) — за
    // handlerFeature; сам CSS статичен относительно значения.
    handlerFeature({
      id: 'custom_font_value',
      name: 'Шрифт: значение', category: 'appearance', tags: ['font'],
      settingsKeys: ['custom_font_value', 'custom_font_id'],
      handler: {
        enable: async (fontValue?: unknown) => {
          if (!fontValue) return;
          if (!isSafeFontFamily(fontValue)) {
            console.warn('[VKify] Rejected unsafe font-family value');
            manager.removeCSS('custom_font');
            unloadGoogleFont();
            manager.disableCss('font');
            return;
          }
          const fv = fontValue;

          // Точечное чтение из кэша — не полный IPC-дамп storage.
          const fontId = await manager.getSetting<string>('custom_font_id');

          if (fontId && Object.prototype.hasOwnProperty.call(FONTS_CONFIG, fontId)) {
            loadGoogleFont(FONTS_CONFIG[fontId]);
          } else {
            unloadGoogleFont();
          }

          manager.injectCSS('custom_font', `
            html[data-vkify-font] {
              --vkify-font-family: ${fv};
            }

            [data-vkify-font],
            [data-vkify-font] body,
            [data-vkify-font] * {
              font-family: var(--vkify-font-family) !important;
            }

            [data-vkify-font] [class*="vkui"],
            [data-vkify-font] [class*="VKUI"],
            [data-vkify-font] div[class*="Text"],
            [data-vkify-font] div[class*="Headline"],
            [data-vkify-font] div[class*="Title"] {
              font-family: var(--vkify-font-family) !important;
            }

            [data-vkify-font] .wall_post_text,
            [data-vkify-font] .im_msg_text,
            [data-vkify-font] .reply_text,
            [data-vkify-font] input,
            [data-vkify-font] textarea,
            [data-vkify-font] button {
              font-family: var(--vkify-font-family) !important;
            }
          `);

          manager.enableCss('font');
        },
        disable: () => {
          manager.removeCSS('custom_font');
          unloadGoogleFont();
          manager.disableCss('font');
        },
      },
    }),

    // Идентификатор пресета шрифта: собственного поведения нет — его читает
    // custom_font_value при применении. Регистрируется, чтобы ключ был известен
    // реестру (интроспекция), обработчик пустой.
    handlerFeature({
      id: 'custom_font_id',
      name: 'Шрифт', category: 'appearance', tags: ['font'],
      handler: { enable: () => { /* no-op */ }, disable: () => { /* no-op */ } },
    }),

    textStyleFeature({
      id: 'custom_font_size', name: 'Размер шрифта', marker: 'font-size',
      compute: (value) => {
        const size = parseInt(String(value), 10);
        if (!size) return null;
        return `
          html[data-vkify-font-size] {
            --vkify-font-size-offset: ${size}px;
          }
          * {
            font-size: var(--vkify-font-size-offset) !important;
          }
        `;
      },
    }),

    textStyleFeature({
      id: 'custom_line_height', name: 'Межстрочный интервал', marker: 'line-height',
      compute: (value) => {
        const percent = parseInt(String(value), 10);
        if (!percent) return null;
        const lineHeight = 1.4 + (percent / 100);
        return `
          ${TEXT_SELECTORS.replace(/TEXT/g, 'line-height')} {
            line-height: ${lineHeight} !important;
          }
        `;
      },
    }),

    textStyleFeature({
      id: 'custom_letter_spacing', name: 'Межбуквенный интервал', marker: 'letter-spacing',
      compute: (value) => {
        const spacing = parseFloat(String(value));
        if (isNaN(spacing) || spacing === 0) return null;
        return `
          ${TEXT_SELECTORS.replace(/TEXT/g, 'letter-spacing')} {
            letter-spacing: ${spacing}px !important;
          }
        `;
      },
    }),

    textStyleFeature({
      id: 'custom_font_weight', name: 'Насыщенность шрифта', marker: 'font-weight',
      compute: (value) => {
        const weight = parseInt(String(value), 10);
        // 400 — нативная насыщенность VK: CSS не нужен.
        if (!weight || weight === 400) return null;
        return `
          ${TEXT_SELECTORS.replace(/TEXT/g, 'font-weight')} {
            font-weight: ${weight} !important;
          }
        `;
      },
    }),

    textStyleFeature({
      id: 'custom_font_style', name: 'Стиль шрифта', marker: 'font-style',
      compute: (value) => {
        if (!value || value === 'normal' || !VALID_FONT_STYLES.has(String(value))) return null;
        return `
          ${TEXT_SELECTORS.replace(/TEXT/g, 'font-style')} {
            font-style: ${String(value)} !important;
          }
        `;
      },
    }),

    textStyleFeature({
      id: 'custom_text_decoration', name: 'Оформление текста', marker: 'text-decoration',
      compute: (value) => {
        if (!value || value === 'none' || !VALID_TEXT_DECORATIONS.has(String(value))) return null;
        return `
          ${TEXT_SELECTORS.replace(/TEXT/g, 'text-decoration')} {
            text-decoration: ${String(value)} !important;
          }
        `;
      },
    }),

    textStyleFeature({
      id: 'custom_text_transform', name: 'Регистр текста', marker: 'text-transform',
      compute: (value) => {
        if (!value || value === 'none' || !VALID_TEXT_TRANSFORMS.has(String(value))) return null;
        return `
          ${TEXT_SELECTORS.replace(/TEXT/g, 'text-transform')} {
            text-transform: ${String(value)} !important;
          }
        `;
      },
    }),
  ];
}
