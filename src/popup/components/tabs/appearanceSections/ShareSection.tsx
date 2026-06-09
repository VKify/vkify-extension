import React, { useState, useCallback } from 'react';
import { useSettings } from '../../../context/SettingsContext.js';
import { useToast } from '../../../context/ToastContext.js';
import type { Settings } from '../../../context/SettingsContext.js';
import { siteUrl } from '../../../../shared/constants/site.js';
import { ShareIcon, CheckIcon, CopyIcon } from '../../icons/Icons.js';

// Синхронизировано с frontend/src/utils/themeShare.js

const SCHEMA_VERSION = 2;

/** Все параметры вкладок «Вид» и «Элементы» */
const APPEARANCE_KEYS: readonly string[] = [
  // Тема
  'custom_theme', 'custom_accent', 'block_opacity', 'glass_blur', 'theme_radius', 'block_depth',
  // Шрифт
  'custom_font_id', 'custom_font_value', 'custom_font_size', 'custom_line_height',
  'custom_letter_spacing', 'custom_font_weight', 'custom_font_style',
  'custom_text_decoration', 'custom_text_transform',
  // Layout
  'border_radius', 'content_width', 'content_width_enabled', 'compact_spacing',
  'page_offset_enabled', 'page_offset_value', 'custom_theme_id',
  // Режим отображения
  'minimalistic_sidebar', 'fixed_sidebar', 'sidebar_with_background', 'collapse_search',
  // Фон
  'custom_background', 'background_type',
  'background_blur', 'background_dim', 'background_opacity',
  'background_brightness', 'background_contrast', 'background_saturation',
  'background_scale', 'background_hue_rotate', 'background_sepia', 'background_grayscale',
  'background_position', 'background_size',
  'background_overlay_color', 'background_overlay_opacity',
  'background_vignette', 'background_video_speed', 'background_video_volume',
  // Визуальные фильтры
  'filter_grayscale', 'filter_sepia', 'filter_invert',
  'filter_dim_images', 'filter_high_contrast', 'filter_low_brightness',
  // Скрытые элементы
  'hide_stories', 'hide_recommendations', 'hide_friends_suggestions',
  'hide_emoji_status', 'hide_mini_chat', 'hide_scroll_top',
  'hide_menu_settings', 'hide_auth_popup',
];

/**
 * Дефолтные значения — параметры с этими значениями пропускаются при кодировании.
 * block_opacity хранится как float 0.0–1.0 (1 = 100% непрозрачности).
 */
const DEFAULTS: Record<string, unknown> = {
  block_opacity:             1,
  glass_blur:                0,
  theme_radius:              0,
  block_depth:               false,
  custom_font_size:          0,
  custom_line_height:        0,
  custom_letter_spacing:     0,
  custom_font_weight:        400,
  custom_font_style:         'normal',
  custom_text_decoration:    'none',
  custom_text_transform:     'none',
  border_radius:             0,
  content_width:             0,
  content_width_enabled:     false,
  compact_spacing:           false,
  page_offset_enabled:       false,
  page_offset_value:         50,
  minimalistic_sidebar:      false,
  fixed_sidebar:             false,
  sidebar_with_background:   false,
  collapse_search:           false,
  background_blur:           0,
  background_dim:            0,
  background_opacity:        100,
  background_brightness:     100,
  background_contrast:       100,
  background_saturation:     100,
  background_scale:          100,
  background_hue_rotate:     0,
  background_sepia:          0,
  background_grayscale:      0,
  background_position:       'center',
  background_size:           'cover',
  background_overlay_opacity: 0,
  background_vignette:       0,
  background_video_speed:    100,
  background_video_volume:   0,
  filter_grayscale:          false,
  filter_sepia:              false,
  filter_invert:             false,
  filter_dim_images:         false,
  filter_high_contrast:      false,
  filter_low_brightness:     false,
  hide_stories:              false,
  hide_recommendations:      false,
  hide_friends_suggestions:  false,
  hide_emoji_status:         false,
  hide_mini_chat:            false,
  hide_scroll_top:           false,
  hide_menu_settings:        false,
  hide_auth_popup:           false,
};

/** Таблица коротких алиасов: полный ключ → короткий (v:2) */
const KEY_MAP: Record<string, string> = {
  custom_theme: 'ct', custom_accent: 'ca', block_opacity: 'bo', glass_blur: 'gb', theme_radius: 'tr',
  block_depth: 'bd',
  custom_font_id: 'fi', custom_font_value: 'fv', custom_font_size: 'fs', custom_line_height: 'lh',
  custom_letter_spacing: 'ls', custom_font_weight: 'fw', custom_font_style: 'fy',
  custom_text_decoration: 'td', custom_text_transform: 'tm',
  border_radius: 'br', content_width: 'cw', content_width_enabled: 'cwe', compact_spacing: 'cp',
  page_offset_enabled: 'pe', page_offset_value: 'pv', custom_theme_id: 'ti',
  minimalistic_sidebar: 'ms', fixed_sidebar: 'fx', sidebar_with_background: 'sw', collapse_search: 'cs',
  custom_background: 'cb', background_type: 'bt',
  background_blur: 'bl', background_dim: 'dm', background_opacity: 'op',
  background_brightness: 'bb', background_contrast: 'bc', background_saturation: 'bs',
  background_scale: 'bk', background_hue_rotate: 'bh', background_sepia: 'bp', background_grayscale: 'bg',
  background_position: 'bx', background_size: 'bz',
  background_overlay_color: 'oc', background_overlay_opacity: 'oo',
  background_vignette: 'bv', background_video_speed: 'vs', background_video_volume: 'vv',
  filter_grayscale: 'fg', filter_sepia: 'fp', filter_invert: 'fn',
  filter_dim_images: 'di', filter_high_contrast: 'hc', filter_low_brightness: 'lb',
  hide_stories: 'hs', hide_recommendations: 'hd', hide_friends_suggestions: 'hf',
  hide_emoji_status: 'he', hide_mini_chat: 'hm', hide_scroll_top: 'ht',
  hide_menu_settings: 'hg', hide_auth_popup: 'ha',
};

function encodeThemeSettings(settings: Settings): string | null {
  const params: Record<string, unknown> = {};

  APPEARANCE_KEYS.forEach(key => {
    const val = settings[key] as unknown;

    // Пропускаем: undefined / null / ''
    if (val === undefined || val === null || val === '') return;

    // Пропускаем дефолтные значения — они не несут информации.
    // ВАЖНО: этот блок идёт ДО фильтра false/0, чтобы page_offset_value=0
    // (дефолт=50) корректно сохранялся в URL.
    if (key in DEFAULTS && val === DEFAULTS[key]) return;

    // Пропускаем оставшиеся "выключенные" булевы без дефолта
    if (val === false) return;

    // Пропускаем фоны из файловой системы расширения — недоступны другим пользователям
    if (key === 'custom_background' && /^(?:chrome|moz)-extension:/i.test(String(val))) return;

    // Сохраняем под коротким алиасом
    const shortKey = KEY_MAP[key] ?? key;
    params[shortKey] = val;
  });

  const payload = { v: SCHEMA_VERSION, p: params };

  try {
    const json = JSON.stringify(payload);
    // TextEncoder → корректная работа с кириллицей
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    const b64 = btoa(binary);
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch (e) {
    console.error('[VKify] Share encode error:', e);
    return null;
  }
}

type ShareState = 'idle' | 'loading' | 'copied' | 'error';

interface ShareButtonProps {
  compact?: boolean;
}

export default function ShareButton({ compact = false }: ShareButtonProps): React.ReactElement {
  const { settings } = useSettings();
  const { showToast } = useToast();
  const [state, setState] = useState<ShareState>('idle');

  const handleShare = useCallback(async (): Promise<void> => {
    if (state === 'loading') return;
    setState('loading');

    try {
      const encoded = encodeThemeSettings(settings);
      if (!encoded) throw new Error('Encode failed');

      const url = siteUrl(`/theme/${encoded}`);
      await navigator.clipboard.writeText(url);

      setState('copied');
      showToast?.('Ссылка скопирована!', 'success');

      setTimeout(() => setState('idle'), 2500);
    } catch (e) {
      console.error('[VKify] Share error:', e);
      setState('error');
      showToast?.('Не удалось скопировать', 'error');
      setTimeout(() => setState('idle'), 2000);
    }
  }, [settings, state, showToast]);

  const hasTheme = Boolean(
    settings['custom_theme'] || settings['custom_accent'] || settings['custom_background'] ||
    APPEARANCE_KEYS.some(k => {
      const v = settings[k] as unknown;
      if (v === undefined || v === null || v === '' || v === false) return false;
      if (k in DEFAULTS && v === DEFAULTS[k]) return false;
      return true;
    })
  );

  if (compact) {
    return (
      <button
        onClick={() => { void handleShare(); }}
        disabled={!hasTheme || state === 'loading'}
        title={hasTheme ? 'Поделиться темой' : 'Нет активной темы'}
        className={`
          flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200
          ${!hasTheme
            ? 'opacity-30 cursor-not-allowed bg-[var(--bg-secondary)]'
            : state === 'copied'
              ? 'bg-green-500/15 text-green-500'
              : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
          }
        `}
      >
        {state === 'copied'
          ? <CheckIcon className="w-3.5 h-3.5" />
          : <ShareIcon className="w-3.5 h-3.5" />}
      </button>
    );
  }

  return (
    <button
      onClick={() => { void handleShare(); }}
      disabled={state === 'loading'}
      className={`
        w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
        text-sm font-medium transition-all duration-200 active:scale-95
        ${state === 'copied'
          ? 'bg-green-500/15 text-green-600 border border-green-500/20'
          : state === 'error'
            ? 'bg-red-500/10 text-red-500 border border-red-500/20'
            : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] hover:border-primary/40 hover:bg-primary/5'
        }
      `}
    >
      {state === 'copied' ? (
        <>
          <CheckIcon className="w-4 h-4 flex-shrink-0" />
          <span>Ссылка скопирована!</span>
        </>
      ) : state === 'loading' ? (
        <>
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>Генерируем...</span>
        </>
      ) : (
        <>
          <ShareIcon className="w-4 h-4 flex-shrink-0" />
          <span>Поделиться темой</span>
          {!hasTheme && <span className="text-xs text-[var(--text-tertiary)]">(нет темы)</span>}
        </>
      )}
    </button>
  );
}

export function ShareUrlDisplay({ settings }: { settings: Settings }): React.ReactElement {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = useCallback((): void => {
    const encoded = encodeThemeSettings(settings);
    if (encoded) setUrl(siteUrl(`/theme/${encoded}`));
  }, [settings]);

  const handleCopy = useCallback((): void => {
    if (!url) return;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [url]);

  if (!url) {
    return (
      <button
        onClick={generate}
        className="w-full py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-xl transition-colors flex items-center justify-center gap-1.5"
      >
        <ShareIcon className="w-3.5 h-3.5" />
        Сгенерировать ссылку
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 p-2.5 bg-[var(--bg-secondary)] rounded-xl">
      <span className="flex-1 text-[10px] font-mono text-[var(--text-secondary)] truncate">{url}</span>
      <button
        onClick={handleCopy}
        className="flex-shrink-0 text-primary hover:text-primary/70 transition-colors"
      >
        {copied ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}