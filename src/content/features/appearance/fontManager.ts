import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '../../../types/index.js';

const GOOGLE_FONTS_API = 'https://fonts.googleapis.com/css2';
const FONT_LINK_ID = 'vkify-google-font';

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

function loadGoogleFont(fontQuery: string) {
  document.getElementById(FONT_LINK_ID)?.remove();

  const link = document.createElement('link');
  link.id = FONT_LINK_ID;
  link.rel = 'stylesheet';
  link.href = `${GOOGLE_FONTS_API}?family=${fontQuery}&display=swap`;
  document.head.appendChild(link);
}

function unloadGoogleFont() {
  document.getElementById(FONT_LINK_ID)?.remove();
}

export function createFontFeatures(manager: FeatureManager): FeatureMap {
  return {
    custom_font_value: {
      enable: async (fontValue?: unknown) => {
        if (!fontValue) return;
        const fv = fontValue as string;

        const settings = await manager.getAllSettings();
        const fontId = settings.custom_font_id as string | undefined;

        if (fontId && FONTS_CONFIG[fontId]) {
          loadGoogleFont(FONTS_CONFIG[fontId]);
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

        document.documentElement.setAttribute('data-vkify-font', 'true');
      },
      disable: () => {
        manager.removeCSS('custom_font');
        unloadGoogleFont();
        document.documentElement.removeAttribute('data-vkify-font');
      },
    },

    custom_font_id: {
      enable: () => { /* no-op */ },
      disable: () => { /* no-op */ },
    },

    custom_font_size: {
      enable: (value?: unknown) => {
        const size = parseInt(String(value), 10);
        if (!size || size === 0) return;

        manager.injectCSS('custom_font_size', `
          html[data-vkify-font-size] {
            --vkify-font-size-offset: ${size}px;
          }
          * {
            font-size: var(--vkify-font-size-offset) !important;
          }
        `);

        document.documentElement.setAttribute('data-vkify-font-size', 'true');
      },
      disable: () => {
        manager.removeCSS('custom_font_size');
        document.documentElement.removeAttribute('data-vkify-font-size');
      },
    },

    custom_line_height: {
      enable: (value?: unknown) => {
        const percent = parseInt(String(value), 10);
        if (!percent || percent === 0) return;

        const lineHeight = 1.4 + (percent / 100);

        manager.injectCSS('custom_line_height', `
          ${TEXT_SELECTORS.replace(/TEXT/g, 'line-height')} {
            line-height: ${lineHeight} !important;
          }
        `);

        document.documentElement.setAttribute('data-vkify-line-height', 'true');
      },
      disable: () => {
        manager.removeCSS('custom_line_height');
        document.documentElement.removeAttribute('data-vkify-line-height');
      },
    },

    custom_letter_spacing: {
      enable: (value?: unknown) => {
        const spacing = parseFloat(String(value));
        if (isNaN(spacing) || spacing === 0) return;

        manager.injectCSS('custom_letter_spacing', `
          ${TEXT_SELECTORS.replace(/TEXT/g, 'letter-spacing')} {
            letter-spacing: ${spacing}px !important;
          }
        `);

        document.documentElement.setAttribute('data-vkify-letter-spacing', 'true');
      },
      disable: () => {
        manager.removeCSS('custom_letter_spacing');
        document.documentElement.removeAttribute('data-vkify-letter-spacing');
      },
    },

    custom_font_weight: {
      enable: (value?: unknown) => {
        const weight = parseInt(String(value), 10);
        if (!weight || weight === 400) return;

        manager.injectCSS('custom_font_weight', `
          ${TEXT_SELECTORS.replace(/TEXT/g, 'font-weight')} {
            font-weight: ${weight} !important;
          }
        `);

        document.documentElement.setAttribute('data-vkify-font-weight', 'true');
      },
      disable: () => {
        manager.removeCSS('custom_font_weight');
        document.documentElement.removeAttribute('data-vkify-font-weight');
      },
    },

    custom_font_style: {
      enable: (value?: unknown) => {
        if (!value || value === 'normal') return;
        if (!VALID_FONT_STYLES.has(String(value))) return;

        manager.injectCSS('custom_font_style', `
          ${TEXT_SELECTORS.replace(/TEXT/g, 'font-style')} {
            font-style: ${value} !important;
          }
        `);

        document.documentElement.setAttribute('data-vkify-font-style', 'true');
      },
      disable: () => {
        manager.removeCSS('custom_font_style');
        document.documentElement.removeAttribute('data-vkify-font-style');
      },
    },

    custom_text_decoration: {
      enable: (value?: unknown) => {
        if (!value || value === 'none') return;
        if (!VALID_TEXT_DECORATIONS.has(String(value))) return;

        manager.injectCSS('custom_text_decoration', `
          ${TEXT_SELECTORS.replace(/TEXT/g, 'text-decoration')} {
            text-decoration: ${value} !important;
          }
        `);

        document.documentElement.setAttribute('data-vkify-text-decoration', 'true');
      },
      disable: () => {
        manager.removeCSS('custom_text_decoration');
        document.documentElement.removeAttribute('data-vkify-text-decoration');
      },
    },

    custom_text_transform: {
      enable: (value?: unknown) => {
        if (!value || value === 'none') return;
        if (!VALID_TEXT_TRANSFORMS.has(String(value))) return;

        manager.injectCSS('custom_text_transform', `
          ${TEXT_SELECTORS.replace(/TEXT/g, 'text-transform')} {
            text-transform: ${value} !important;
          }
        `);

        document.documentElement.setAttribute('data-vkify-text-transform', 'true');
      },
      disable: () => {
        manager.removeCSS('custom_text_transform');
        document.documentElement.removeAttribute('data-vkify-text-transform');
      },
    },
  };
}