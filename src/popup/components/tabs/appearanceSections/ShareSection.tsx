import React, { useState, useCallback, useMemo } from 'react';
import { useVKifyStore } from '@/popup/store/index.js';
import { useToast } from '@/popup/context/ToastContext.js';
import type { Settings } from '@/popup/store/slices/settingsSlice.js';
import { siteUrl } from '@/shared/constants/site.js';
import { ShareIcon, CheckIcon, CopyIcon, ChevronDownIcon, LinkIcon } from '../../icons/Icons.js';
import { APPEARANCE_KEYS, DEFAULTS } from '@/popup/utils/appearanceProfile.js';

// Синхронизировано с frontend/src/utils/themeShare.js
// APPEARANCE_KEYS и DEFAULTS — общий источник истины с локальными профилями
// (см. utils/appearanceProfile.ts).

const SCHEMA_VERSION = 2;

/** Таблица коротких алиасов: полный ключ → короткий (v:2) */
const KEY_MAP: Record<string, string> = {
  custom_theme: 'ct', custom_accent: 'ca', block_opacity: 'bo', glass_blur: 'gb', theme_radius: 'tr',
  block_depth: 'bd',
  custom_font_id: 'fi', custom_font_value: 'fv', custom_font_size: 'fs', custom_line_height: 'lh',
  custom_letter_spacing: 'ls', custom_font_weight: 'fw', custom_font_style: 'fy',
  custom_text_decoration: 'td', custom_text_transform: 'tm',
  border_radius: 'br', avatar_radius_shape: 'av',
  content_width: 'cw', content_width_enabled: 'cwe', compact_spacing: 'cp',
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
  hide_stories: 'hs', hide_post_box: 'hpb', hide_post_comments: 'hpc',
  hide_recommendations: 'hd', hide_friends_suggestions: 'hf',
  hide_emoji_status: 'he', hide_mini_chat: 'hm', hide_scroll_top: 'ht',
  hide_menu_settings: 'hg', hide_menu_counters: 'hmc', hide_audio_ads: 'haa',
  hide_recent_groups: 'hrg', hide_recommended_channels: 'hrc', hide_auth_popup: 'ha',
};

/** Параметр, который попадёт в ссылку: полный ключ + его значение. */
export interface ShareParam {
  key: string;
  value: unknown;
}

/**
 * Собирает список параметров, которые реально будут закодированы в ссылку.
 * Единственный источник истины для encodeThemeSettings и превью
 * «Что попадёт в ссылку» — фильтры обязаны совпадать.
 */
export function collectShareParams(settings: Settings): ShareParam[] {
  const out: ShareParam[] = [];

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

    out.push({ key, value: val });
  });

  return out;
}

function encodeThemeSettings(settings: Settings): string | null {
  const params: Record<string, unknown> = {};

  // Сохраняем под короткими алиасами
  collectShareParams(settings).forEach(({ key, value }) => {
    params[KEY_MAP[key] ?? key] = value;
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
  const settings = useVKifyStore((s) => s.settings);
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

  const hasTheme = collectShareParams(settings).length > 0;

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

// ─── Превью «Что попадёт в ссылку» ──────────────────────────────────────────

/** Человекочитаемые подписи параметров, сгруппированные как секции вкладки «Вид». */
const PARAM_GROUPS: { title: string; labels: Record<string, string> }[] = [
  {
    title: 'Тема',
    labels: {
      custom_theme: 'Тема', custom_theme_id: 'Пресет темы', custom_accent: 'Акцентный цвет',
      block_opacity: 'Прозрачность блоков', glass_blur: 'Стеклянное размытие',
      theme_radius: 'Скругление темы', block_depth: 'Глубина блоков',
    },
  },
  {
    title: 'Шрифт',
    labels: {
      custom_font_id: 'Шрифт', custom_font_value: 'Семейство шрифта',
      custom_font_size: 'Размер шрифта', custom_line_height: 'Межстрочный интервал',
      custom_letter_spacing: 'Межбуквенный интервал', custom_font_weight: 'Насыщенность',
      custom_font_style: 'Стиль', custom_text_decoration: 'Декорация', custom_text_transform: 'Регистр',
    },
  },
  {
    title: 'Макет',
    labels: {
      border_radius: 'Скругление углов', avatar_radius_shape: 'Форма аватарок',
      content_width: 'Ширина контента', content_width_enabled: 'Ограничение ширины',
      compact_spacing: 'Компактные отступы', page_offset_enabled: 'Смещение страницы',
      page_offset_value: 'Величина смещения',
    },
  },
  {
    title: 'Режим отображения',
    labels: {
      minimalistic_sidebar: 'Минималистичный сайдбар', fixed_sidebar: 'Закреплённый сайдбар',
      sidebar_with_background: 'Сайдбар с фоном', collapse_search: 'Свёрнутый поиск',
    },
  },
  {
    title: 'Фон',
    labels: {
      custom_background: 'Изображение / видео', background_type: 'Тип фона',
      background_blur: 'Размытие', background_dim: 'Затемнение', background_opacity: 'Прозрачность',
      background_brightness: 'Яркость', background_contrast: 'Контраст',
      background_saturation: 'Насыщенность', background_scale: 'Масштаб',
      background_hue_rotate: 'Сдвиг оттенка', background_sepia: 'Сепия',
      background_grayscale: 'Обесцвечивание', background_position: 'Позиция',
      background_size: 'Размер', background_overlay_color: 'Цвет оверлея',
      background_overlay_opacity: 'Прозрачность оверлея', background_vignette: 'Виньетка',
      background_video_speed: 'Скорость видео', background_video_volume: 'Громкость видео',
    },
  },
  {
    title: 'Визуальные фильтры',
    labels: {
      filter_grayscale: 'Чёрно-белый режим', filter_sepia: 'Сепия', filter_invert: 'Инверсия',
      filter_dim_images: 'Затемнение картинок', filter_high_contrast: 'Высокий контраст',
      filter_low_brightness: 'Пониженная яркость',
    },
  },
  {
    title: 'Скрытые элементы',
    labels: {
      hide_stories: 'Истории', hide_post_box: 'Добавление поста',
      hide_post_comments: 'Комментарии', hide_recommendations: 'Рекомендации',
      hide_friends_suggestions: 'Возможные друзья', hide_emoji_status: 'Эмодзи-статусы',
      hide_mini_chat: 'Мини-чат', hide_scroll_top: 'Кнопка «Наверх»',
      hide_menu_settings: 'Настройки в меню', hide_menu_counters: 'Счётчики в меню',
      hide_audio_ads: 'Реклама в музыке', hide_recent_groups: 'Недавние группы',
      hide_recommended_channels: 'Рекомендуемые каналы', hide_auth_popup: 'Окно авторизации',
    },
  },
];

/** Короткое отображение значения в чипе; null — чип без значения (булево «вкл»). */
function formatParamValue(key: string, value: unknown): string | null {
  if (value === true) return null;
  if (key === 'custom_background') return 'URL';
  if (key === 'block_opacity' && typeof value === 'number') return `${Math.round(value * 100)}%`;
  const str = String(value);
  return str.length > 22 ? `${str.slice(0, 22)}…` : str;
}

/** Значение-цвет? Тогда в чипе рисуем образец. */
function asColor(value: unknown): string | null {
  return typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value) ? value : null;
}

/**
 * Раскрывающийся блок под кнопкой «Поделиться»: показывает, какие именно
 * параметры (и с какими значениями) будут закодированы в ссылку. Использует
 * collectShareParams — тот же фильтр, что и сама генерация ссылки.
 */
export function ShareParamsPreview(): React.ReactElement {
  const settings = useVKifyStore((s) => s.settings);
  const [expanded, setExpanded] = useState(false);

  const groups = useMemo(() => {
    const byKey = new Map(collectShareParams(settings).map(p => [p.key, p.value]));
    const known = new Set<string>();
    const result = PARAM_GROUPS
      .map(g => ({
        title: g.title,
        items: Object.entries(g.labels)
          .filter(([key]) => { known.add(key); return byKey.has(key); })
          .map(([key, label]) => ({ key, label, value: byKey.get(key) })),
      }))
      .filter(g => g.items.length > 0);

    // Параметры без подписи (новые ключи) — не теряем, показываем как есть.
    const rest = [...byKey.entries()].filter(([key]) => !known.has(key));
    if (rest.length > 0) {
      result.push({
        title: 'Прочее',
        items: rest.map(([key, value]) => ({ key, label: key, value })),
      });
    }
    return result;
  }, [settings]);

  const count = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="rounded-xl border border-[var(--border-color)] overflow-hidden">
      <button
        onClick={() => setExpanded(prev => !prev)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-[var(--bg-secondary)]/60 transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          <LinkIcon className="w-3.5 h-3.5 text-[var(--text-tertiary)] flex-shrink-0" />
          <span className="text-xs font-medium text-[var(--text-primary)] truncate">
            Что попадёт в ссылку
          </span>
          <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md flex-shrink-0 ${
            count > 0 ? 'text-primary bg-primary/10' : 'text-[var(--text-tertiary)] bg-[var(--bg-secondary)]'
          }`}>
            {count}
          </span>
        </span>
        <ChevronDownIcon
          className={`w-3.5 h-3.5 flex-shrink-0 text-[var(--text-tertiary)] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      <div className={`grid transition-all duration-300 ease-out ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          {count === 0 ? (
            <p className="px-3 pb-3 text-xs text-[var(--text-tertiary)]">
              Все настройки сейчас со значениями по умолчанию — в ссылке ничего не будет.
            </p>
          ) : (
            <div className="px-3 pb-3 space-y-2.5">
              {groups.map(group => (
                <div key={group.title}>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    {group.title}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map(item => {
                      const color = asColor(item.value);
                      const value = formatParamValue(item.key, item.value);
                      return (
                        <span
                          key={item.key}
                          className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] rounded-lg bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                        >
                          {item.label}
                          {color ? (
                            <span className="inline-flex items-center gap-1 font-mono font-medium text-[var(--text-primary)]">
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-[var(--border-color)]"
                                style={{ backgroundColor: color }}
                                aria-hidden="true"
                              />
                              {color.toUpperCase()}
                            </span>
                          ) : value !== null && (
                            <span className="font-mono font-medium text-[var(--text-primary)]">{value}</span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
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