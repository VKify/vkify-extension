import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useVKifyStore } from '@/popup/store/index.js';
import { useToast } from '@/popup/context/ToastContext.js';
import type { Settings } from '@/popup/store/slices/settingsSlice.js';
import { siteUrl } from '@/shared/constants/site.js';
import { ShareIcon, CheckIcon, CopyIcon, ChevronDownIcon, LinkIcon } from '../../icons/Icons.js';
import { collectShareParams, encodeThemeSettings } from '@/popup/utils/themeShare.js';
import { copyText } from '@/popup/utils/clipboard.js';

type ShareState = 'idle' | 'loading' | 'copied' | 'error';

interface ShareButtonProps {
  compact?: boolean;
}

export default function ShareButton({ compact = false }: ShareButtonProps): React.ReactElement {
  const { t } = useTranslation('appearance');
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
      await copyText(url);

      setState('copied');
      showToast?.(t('share.toast_copied'), 'success');

      setTimeout(() => setState('idle'), 2500);
    } catch (e) {
      console.error('[VKify] Share error:', e);
      setState('error');
      showToast?.(t('share.toast_failed'), 'error');
      setTimeout(() => setState('idle'), 2000);
    }
  }, [settings, state, showToast, t]);

  const hasTheme = collectShareParams(settings).length > 0;

  if (compact) {
    return (
      <button
        onClick={() => { void handleShare(); }}
        disabled={!hasTheme || state === 'loading'}
        title={hasTheme ? t('share.button') : t('share.no_theme_title')}
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
      disabled={!hasTheme || state === 'loading'}
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
          <span>{t('share.copied')}</span>
        </>
      ) : state === 'loading' ? (
        <>
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>{t('share.generating')}</span>
        </>
      ) : (
        <>
          <ShareIcon className="w-4 h-4 flex-shrink-0" />
          <span>{t('share.button')}</span>
          {!hasTheme && <span className="text-xs text-[var(--text-tertiary)]">{t('share.no_theme_hint')}</span>}
        </>
      )}
    </button>
  );
}

// ─── Превью «Что попадёт в ссылку» ──────────────────────────────────────────

/**
 * Человекочитаемые подписи параметров, сгруппированные как секции вкладки «Вид».
 * `id`/ключи локализуются через appearance:share.groups/labels на рендере;
 * строки здесь — RU-фолбэк (defaultValue).
 */
const PARAM_GROUPS: { id: string; title: string; labels: Record<string, string> }[] = [
  {
    id: 'theme',
    title: 'Тема',
    labels: {
      custom_theme: 'Тема', custom_theme_id: 'Пресет темы', custom_accent: 'Акцентный цвет',
      block_opacity: 'Прозрачность блоков', glass_blur: 'Стеклянное размытие',
      theme_radius: 'Скругление темы', block_depth: 'Глубина блоков',
    },
  },
  {
    id: 'font',
    title: 'Шрифт',
    labels: {
      custom_font_id: 'Шрифт', custom_font_value: 'Семейство шрифта',
      custom_font_size: 'Размер шрифта', custom_line_height: 'Межстрочный интервал',
      custom_letter_spacing: 'Межбуквенный интервал', custom_font_weight: 'Насыщенность',
      custom_font_style: 'Стиль', custom_text_decoration: 'Декорация', custom_text_transform: 'Регистр',
    },
  },
  {
    id: 'layout',
    title: 'Макет',
    labels: {
      border_radius: 'Скругление углов', avatar_radius_shape: 'Форма аватарок',
      content_width: 'Ширина контента', content_width_enabled: 'Ограничение ширины',
      compact_spacing: 'Компактные отступы', page_offset_enabled: 'Смещение страницы',
      page_offset_value: 'Величина смещения',
    },
  },
  {
    id: 'display_mode',
    title: 'Режим отображения',
    labels: {
      minimalistic_sidebar: 'Минималистичный сайдбар', fixed_sidebar: 'Закреплённый сайдбар',
      sidebar_with_background: 'Сайдбар с фоном', collapse_search: 'Свёрнутый поиск',
    },
  },
  {
    id: 'background',
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
    id: 'filters',
    title: 'Визуальные фильтры',
    labels: {
      filter_grayscale: 'Чёрно-белый режим', filter_sepia: 'Сепия', filter_invert: 'Инверсия',
      filter_dim_images: 'Затемнение картинок', filter_high_contrast: 'Высокий контраст',
      filter_low_brightness: 'Пониженная яркость',
    },
  },
  {
    id: 'hidden',
    title: 'Скрытые элементы',
    labels: {
      hide_stories: 'Истории', hide_post_box: 'Добавление поста',
      hide_post_comments: 'Комментарии',
      hide_friends_suggestions: 'Возможные друзья', hide_emoji_status: 'Эмодзи-статусы',
      hide_mini_chat: 'Мини-чат', hide_scroll_top: 'Кнопка «Наверх»',
      hide_menu_settings: 'Настройки в меню', hide_menu_counters: 'Счётчики в меню',
      hide_recent_groups: 'Недавние группы',
      hide_recommended_channels: 'Рекомендуемые каналы',
      hide_channels_tab: 'Вкладка «Каналы»',
      hide_business_notifications: 'Бизнес-уведомления',
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
  const { t } = useTranslation('appearance');
  const settings = useVKifyStore((s) => s.settings);
  const [expanded, setExpanded] = useState(false);

  const groups = useMemo(() => {
    const byKey = new Map(collectShareParams(settings).map(p => [p.key, p.value]));
    const known = new Set<string>();
    const result = PARAM_GROUPS
      .map(g => ({
        title: t(`share.groups.${g.id}`, { defaultValue: g.title }),
        items: Object.entries(g.labels)
          .filter(([key]) => { known.add(key); return byKey.has(key); })
          .map(([key, label]) => ({ key, label: t(`share.labels.${key}`, { defaultValue: label }), value: byKey.get(key) })),
      }))
      .filter(g => g.items.length > 0);

    // Параметры без подписи (новые ключи) — не теряем, показываем как есть.
    const rest = [...byKey.entries()].filter(([key]) => !known.has(key));
    if (rest.length > 0) {
      result.push({
        title: t('share.groups.other'),
        items: rest.map(([key, value]) => ({ key, label: t(`share.labels.${key}`, { defaultValue: key }), value })),
      });
    }
    return result;
  }, [settings, t]);

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
            {t('share.preview_title')}
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
              {t('share.preview_empty')}
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
  const { t } = useTranslation('appearance');
  const { showToast } = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { setUrl(null); setCopied(false); }, [settings]);

  const generate = useCallback((): void => {
    const encoded = encodeThemeSettings(settings);
    if (encoded) setUrl(siteUrl(`/theme/${encoded}`));
    else showToast(t('share.toast_failed'), 'error');
  }, [settings, showToast, t]);

  const handleCopy = useCallback((): void => {
    if (!url) return;
    void copyText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => showToast(t('share.toast_failed'), 'error'));
  }, [url, showToast, t]);

  if (!url) {
    return (
      <button
        onClick={generate}
        className="w-full py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-xl transition-colors flex items-center justify-center gap-1.5"
      >
        <ShareIcon className="w-3.5 h-3.5" />
        {t('share.generate')}
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
