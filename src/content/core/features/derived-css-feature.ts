/**
 * derivedCssFeature / derivedCssPlugin — декларативная форма частого паттерна
 * «N настроек → пересчитать → применить CSS-переменные / сгенерированный CSS
 * (+ маркер data-vkify-*)».
 *
 * Раньше каждая такая фича (ширина контента, смещение страницы, …) руками
 * держала одинаковый набор состояния: rafId, persistTimer, markerSet, дебаунс
 * зеркалирования. Здесь весь этот механизм один раз реализован в плагине, а
 * фича описывает только ЧТО вычислять (чистая функция compute).
 *
 * Поведение (в точности повторяет боевое из widescreen/page-offset):
 *   • compute(settings) → { vars?, css? } | null; null = визуально выключено
 *     (маркер снят, CSS убран) при формально включённой фиче;
 *   • CSS-переменные ставятся inline на <html> сразу (перерисовки коалесируются
 *     в один кадр через rAF), а их персист-зеркало (`injectCSS` под id
 *     `<id>_vars`, попадает в localStorage-зеркало для мгновенного применения
 *     на следующей загрузке) пишется сразу при первом применении и с дебаунсом
 *     при последующих пересчётах (перетаскивание слайдера);
 *   • первый персист обязан быть немедленным: reconcileInjectedCss() после
 *     init() вычищает из зеркала всё, что не заинжектировано на самом деле;
 *   • сгенерированный CSS-текст (out.css) инжектируется под id `<id>_css` в том
 *     же ритме (сразу/дебаунс);
 *   • реактивность: изменение любого ключа из `watch` → reapply (settingsPlugin);
 *     изменение самого id-ключа обрабатывает FeatureManager (вкл/выкл).
 */

import type { FeatureDefinition } from './feature-definition.js';
import type { FeatureCategory, FeatureImpact, FeaturePhase } from './feature-registry.js';
import type { FeaturePlugin } from './feature-plugin.js';
import { settingsPlugin } from './feature-plugin.js';
import type { ScopedFeatureContext } from './scoped-context.js';

/** Результат compute: что применить на страницу. */
export interface DerivedCssOutput {
  /** CSS-переменные для :root (inline сразу + персист-зеркало). */
  readonly vars?: Readonly<Record<string, string>>;
  /** Сгенерированный CSS-текст (инжектируется под id `<id>_css`). */
  readonly css?: string;
}

export interface DerivedCssSpec {
  /**
   * Дополнительные ключи настроек: их изменение пересчитывает фичу.
   * Собственный id-ключ указывать не нужно — им управляет FeatureManager.
   */
  readonly watch?: readonly string[];
  /**
   * Имя маркера `data-vkify-<marker>` на <html> (включает colocated-CSS).
   * По умолчанию — id фичи; `false` — маркер не используется.
   * Маркер стоит, пока compute() возвращает не-null.
   */
  readonly marker?: string | false;
  /** Дебаунс персиста зеркала при пересчётах, мс. По умолчанию 200. */
  readonly persistDelayMs?: number;
  /**
   * Чистое вычисление: снимок настроек (только `[id, ...watch]` — не весь
   * storage) → результат. DOM-чтения (измерить раскладку) допустимы;
   * DOM-записи — нет (их делает плагин).
   */
  compute(
    settings: Record<string, unknown>,
    ctx: ScopedFeatureContext,
  ): DerivedCssOutput | null;
}

const DEFAULT_PERSIST_DELAY = 200;

/**
 * Плагин, реализующий механику derived-CSS (см. шапку файла). Один инстанс —
 * одна фича: состояние (raf, дебаунс, применённые переменные) живёт в замыкании.
 */
export function derivedCssPlugin(spec: DerivedCssSpec): FeaturePlugin {
  const persistDelay = spec.persistDelayMs ?? DEFAULT_PERSIST_DELAY;

  /** Ключи переменных, применённых inline в текущем состоянии. */
  let appliedVarKeys: readonly string[] = [];
  let markerSet = false;
  /** Был ли персист с момента включения — первый обязан быть немедленным. */
  let persistedOnce = false;
  let rafId: number | undefined;
  let persistTimer: ReturnType<typeof setTimeout> | undefined;
  /** Последний вычисленный результат — его пишет отложенный персист/раф. */
  let lastOut: DerivedCssOutput | null = null;

  const markerId = (ctx: ScopedFeatureContext): string | null =>
    spec.marker === false ? null : (spec.marker ?? ctx.id);

  const varsCssId = (ctx: ScopedFeatureContext): string => `${ctx.id}_vars`;
  const textCssId = (ctx: ScopedFeatureContext): string => `${ctx.id}_css`;

  function cancelRaf(): void {
    if (rafId !== undefined) { cancelAnimationFrame(rafId); rafId = undefined; }
  }

  function clearPersist(): void {
    if (persistTimer) { clearTimeout(persistTimer); persistTimer = undefined; }
  }

  /** Пишет персист-зеркало (vars + css) из lastOut. */
  function persist(ctx: ScopedFeatureContext): void {
    const out = lastOut;
    if (!out) return;
    const vars = out.vars ?? {};
    const varKeys = Object.keys(vars);
    if (varKeys.length > 0) {
      const body = varKeys.map((k) => `${k}: ${vars[k]};`).join(' ');
      ctx.raw.injectCSS(varsCssId(ctx), `:root { ${body} }`);
    } else {
      ctx.raw.removeCSS(varsCssId(ctx));
    }
    if (out.css) ctx.raw.injectCSS(textCssId(ctx), out.css);
    else ctx.raw.removeCSS(textCssId(ctx));
    persistedOnce = true;
  }

  /** Единственное место DOM-записи: маркер + inline-переменные. */
  function paint(ctx: ScopedFeatureContext, persistNow: boolean): void {
    const out = lastOut;
    if (!out) return;

    const marker = markerId(ctx);
    if (marker && !markerSet) { ctx.raw.enableCss(marker); markerSet = true; }

    const vars = out.vars ?? {};
    const style = document.documentElement.style;
    for (const key of appliedVarKeys) {
      if (!(key in vars)) style.removeProperty(key);
    }
    for (const [key, value] of Object.entries(vars)) {
      style.setProperty(key, value);
    }
    appliedVarKeys = Object.keys(vars);

    if (persistNow) {
      clearPersist();
      persist(ctx);
    } else if (!persistTimer) {
      persistTimer = setTimeout(() => { persistTimer = undefined; persist(ctx); }, persistDelay);
    }
  }

  /** Полное визуальное выключение: маркер, inline-переменные, оба CSS-id. */
  function clearAll(ctx: ScopedFeatureContext): void {
    cancelRaf();
    clearPersist();
    lastOut = null;
    persistedOnce = false;

    const marker = markerId(ctx);
    if (marker && markerSet) { ctx.raw.disableCss(marker); markerSet = false; }

    const style = document.documentElement.style;
    for (const key of appliedVarKeys) style.removeProperty(key);
    appliedVarKeys = [];

    ctx.raw.removeCSS(varsCssId(ctx));
    ctx.raw.removeCSS(textCssId(ctx));
  }

  /**
   * Узкий снимок настроек вместо getAllSettings(): полный дамп storage — это
   * IPC-round-trip со ВСЕМ содержимым (base64-обои, логи) на каждый тик
   * слайдера. Точечные ключи читаются из кэша StorageManager, который
   * chrome.storage.onChanged обновляет ДО уведомления слушателей — значение
   * всегда свежее.
   *
   * Live-preview: числовое `ctx.value` (ENABLE_FEATURE из попапа, ДО записи в
   * storage) трактуется как реал-тайм override ПЕРВОГО watch-ключа — так
   * слайдер применяется мгновенно, минуя дебаунс storage (тот же контракт, что
   * у theme-preview). Штатные триггеры не задевает: тумблер передаёт boolean,
   * reapply — undefined.
   */
  async function readSnapshot(ctx: ScopedFeatureContext): Promise<Record<string, unknown>> {
    const keys = [ctx.id, ...(spec.watch ?? [])];
    const entries = await Promise.all(
      keys.map(async (key) => [key, await ctx.getSetting(key)] as const),
    );
    const snapshot: Record<string, unknown> = Object.fromEntries(entries);
    const firstWatch = spec.watch?.[0];
    if (firstWatch && typeof ctx.value === 'number') snapshot[firstWatch] = ctx.value;
    return snapshot;
  }

  return {
    name: 'derived-css',

    async onEnable(ctx) {
      const settings = await readSnapshot(ctx);
      const out = spec.compute(settings, ctx);

      if (out === null) {
        // Формально включена, визуально неактивна (напр. слайдер в нуле).
        clearAll(ctx);
        return;
      }

      lastOut = out;
      if (!persistedOnce) {
        // Первое применение (включение/первая загрузка): рисуем и зеркалим
        // сразу — reconcile после init() не должен вычистить запись.
        cancelRaf();
        paint(ctx, true);
      } else if (rafId === undefined) {
        // Пересчёт (слайдер/навигация): DOM-записи коалесируются в один кадр,
        // персист — с дебаунсом.
        rafId = requestAnimationFrame(() => { rafId = undefined; paint(ctx, false); });
      }
    },

    onDisable(ctx) {
      clearAll(ctx);
    },
  };
}

export interface DerivedCssFeatureOptions extends DerivedCssSpec {
  readonly id: string;
  readonly name: string;
  readonly category: FeatureCategory;
  /** По умолчанию 'light'. */
  readonly impact?: FeatureImpact;
  /** По умолчанию 'early-css' (визуальный CSS — раньше остального). */
  readonly phase?: FeaturePhase;
  readonly initOrder?: number;
  readonly enabledByDefault?: boolean;
  readonly reapplyOnNavigate?: boolean;
  /**
   * Идемпотентный enable без жёсткого disable→enable при смене значения
   * (см. FeatureDefinition.reapplyOnUpdate). Обязателен для live-preview:
   * иначе каждый тик слайдера делал бы полный teardown (кадр-сброс).
   */
  readonly reapplyOnUpdate?: boolean;
  /** Пути к colocated `.css` (метадата, как у cssFeature). */
  readonly cssFiles?: string | readonly string[];
  readonly tags?: readonly string[];
}

/**
 * Строит FeatureDefinition для derived-CSS-фичи:
 * plugins = [settingsPlugin(watch), derivedCssPlugin(spec)],
 * settingsKeys = [id, ...watch].
 */
export function derivedCssFeature(opts: DerivedCssFeatureOptions): FeatureDefinition {
  const {
    id, name, category, impact, phase, initOrder,
    enabledByDefault, reapplyOnNavigate, reapplyOnUpdate, cssFiles, tags,
    ...spec
  } = opts;

  const files = typeof cssFiles === 'string' ? [cssFiles] : cssFiles;
  const watch = spec.watch ?? [];

  const plugins: FeaturePlugin[] = [];
  if (watch.length > 0) plugins.push(settingsPlugin(watch));
  plugins.push(derivedCssPlugin(spec));

  return {
    id,
    name,
    category,
    impact: impact ?? 'light',
    phase: phase ?? 'early-css',
    initOrder,
    enabledByDefault,
    reapplyOnNavigate,
    reapplyOnUpdate,
    cssFiles: files,
    settingsKeys: [id, ...watch],
    tags,
    plugins,
  };
}
