import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useVKifyStore } from '@/popup/store/index.js';
import { useToast } from '@/popup/context/ToastContext.js';
import { siteUrl } from '@/shared/constants/site.js';
import { ShareIcon, ChevronDownIcon, LinkIcon } from '../../icons/Icons.js';
import { collectShareParams, encodeThemeSettings, hasLocalThemeBackground } from '@/popup/utils/themeShare.js';
import ThemeShareDialog from './ThemeShareDialog.js';

export default function ShareButton({ compact = false }: { compact?: boolean }): React.ReactElement {
  const { t } = useTranslation('appearance');
  const settings = useVKifyStore(s => s.settings);
  const { showToast } = useToast();
  const [share, setShare] = useState<{ url: string; localBackground: boolean } | null>(null);
  const hasTheme = collectShareParams(settings).length > 0;
  const open = (): void => {
    const encoded = encodeThemeSettings(settings);
    if (!encoded) { showToast(t('share.toast_encode_failed'), 'error'); return; }
    setShare({ url: siteUrl('/theme/' + encoded), localBackground: hasLocalThemeBackground(settings) });
  };
  return <>
    <button type="button" onClick={open} disabled={!hasTheme}
      title={hasTheme ? t('share.button') : t('share.no_theme_title')}
      className={compact
        ? 'flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-30'
        : 'w-full flex items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-40'}>
      <ShareIcon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4 shrink-0'} />
      {!compact && <span>{t('share.button')}</span>}
    </button>
    {share && <ThemeShareDialog {...share} onClose={() => setShare(null)} />}
  </>;
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
      custom_logo_enabled: 'Свой логотип', custom_logo: 'Изображение логотипа',
      custom_logo_color_mode: 'Режим цвета логотипа', custom_logo_color: 'Цвет логотипа',
      page_offset_enabled: 'Смещение страницы',
      page_offset_value: 'Величина смещения',
    },
  },
  {
    id: 'display_mode',
    title: 'Режим отображения',
    labels: {
      minimalistic_sidebar: 'Минималистичный сайдбар', fixed_sidebar: 'Закреплённый сайдбар',
      tile_sidebar: 'Плиточное меню',
      edge_sidebar: 'Меню у края',
      sidebar_right: 'Меню справа',
      edge_sidebar_width: 'Ширина меню у края', edge_sidebar_background: 'Фон меню у края',
      edge_sidebar_color: 'Цвет меню у края', edge_sidebar_opacity: 'Непрозрачность меню у края',
      edge_sidebar_blur: 'Размытие под меню у края', edge_sidebar_item_radius: 'Скругление пунктов меню у края',
      edge_sidebar_item_height: 'Высота пунктов меню у края',
      sidebar_with_background: 'Сайдбар с фоном', collapse_search: 'Свёрнутый поиск',
      static_header: 'Статичная шапка',
      auto_hide_header: 'Шапка по направлению прокрутки',
      compact_header: 'Компактная шапка',
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
      hide_menu_footer: 'Ссылки под меню',
      hide_recent_groups: 'Недавние группы',
      hide_recommended_channels: 'Рекомендуемые каналы',
      hide_channels_tab: 'Вкладка «Каналы»',
      hide_business_notifications: 'Бизнес-уведомления',
      hide_messenger_filters: 'Панель фильтров и папок',
      hide_messenger_actions: 'Кнопки в шапке списка чатов',
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
      {hasLocalThemeBackground(settings) && (
        <p className="px-3 pb-3 text-xs text-[var(--text-tertiary)]">{t('share.local_background')}</p>
      )}
    </div>
  );
}
