/**
 * Центральный реестр фич content-скрипта.
 *
 * Хранит для каждой фичи её обработчик (`FeatureHandler`, см. types/index.ts) и
 * богатую метадату: категория, «вес» (impact), зависимости, порядок инициализации,
 * флаги и теги. Это единый источник истины для FeatureManager и для интроспекции
 * (например, Performance Dashboard может группировать фичи по impact/категории).
 *
 * Реестр чисто декларативный — он НЕ хранит рантайм-состояние «включена/выключена»
 * (это владение FeatureManager.activeFeatures), только описание фич.
 */

import type { FeatureHandler } from '@/types/index.js';
import { topoSort } from '../util/topo-sort.js';

/** Домены фич — зеркалят разделы попапа и папки features/. */
export type FeatureCategory =
  | 'appearance'   // оформление: тема, фон, шрифты, лэйаут
  | 'hiding'       // точечное скрытие элементов VK
  | 'feed'         // лента
  | 'messages'     // мессенджер
  | 'media'        // плеер, скачивание видео/аудио/фото
  | 'privacy'      // приватность, шифрование, anti-tracking
  | 'ads'          // блокировка рекламы
  | 'spy'          // слежка за активностью/онлайном/профилем
  | 'automation'   // автоматизация (друзья, away-ссылки, раскладка)
  | 'custom-css'   // пользовательский CSS
  | 'performance'  // телеметрия/виджеты производительности
  | 'misc';        // без явной категории (значение по умолчанию)

/** Условный «вес» фичи — прокси нагрузки, без браузерного per-feature CPU. */
export type FeatureImpact = 'light' | 'medium' | 'heavy';

/**
 * Фаза инициализации фичи. Определяет, КОГДА FeatureManager.init() активирует
 * фичу относительно готовности DOM и асинхронных подсистем.
 *
 *   • `early-css` — чистый CSS/маркер, который должен примениться максимально
 *     рано (ещё до первой отрисовки). Реальный «instant»-путь обеспечивает
 *     зеркало в localStorage на document_start (см. core/css-marker-mirror.ts);
 *     фаза лишь гарантирует, что в рамках init() такие фичи активируются первыми.
 *   • `dom-ready` — основная масса фич, которым достаточно готового DOM
 *     (init() вызывается из app.init на DOMContentLoaded). Значение по умолчанию.
 *   • `late` — фичи, зависящие от API/LongPoll/тяжёлых подсистем; активируются
 *     отложенно (после готовности DOM, в idle-колбэке), чтобы не задерживать
 *     первый интерактив страницы.
 */
export type FeaturePhase = 'early-css' | 'dom-ready' | 'late';

/** Канонический порядок фаз — от самой ранней к самой поздней. */
export const PHASE_ORDER: readonly FeaturePhase[] = ['early-css', 'dom-ready', 'late'];

export interface FeatureMetadata {
  readonly id: string;
  /** Человекочитаемое имя (для интроспекции/логов). */
  readonly name: string;
  readonly category: FeatureCategory;
  readonly impact: FeatureImpact;
  /** Фаза инициализации (early-css → dom-ready → late). По умолчанию 'dom-ready'. */
  readonly phase: FeaturePhase;
  /** id других фич, которые должны быть включены раньше этой. */
  readonly dependencies: readonly string[];
  /** Порядок инициализации внутри resolveDependencies (меньше — раньше). */
  readonly initOrder: number;
  /** Включена ли фича по умолчанию (для справки/интроспекции). */
  readonly enabledByDefault: boolean;
  /** Опирается ли фича на централизованный DOM-слой (observer/selectors). */
  readonly requiresDomLayer: boolean;
  /**
   * Пути к colocated `.css`-файлам фичи (агрегируются в styles/features.css,
   * см. vite.config.ts). Декларативно; реальное включение — через маркер
   * `data-vkify-<id>`. Для интроспекции и аудита «какой CSS чья фича».
   */
  readonly cssFiles: readonly string[];
  /**
   * Ключи настроек, за которые отвечает фича. Изменение любого из них
   * переинициализирует фичу (reactivity). См. feature-definition.ts.
   */
  readonly settingsKeys: readonly string[];
  readonly tags: readonly string[];
}

/** Частичная метадата для регистрации/описания — id выводится отдельно. */
export type FeatureMetadataInput = Partial<Omit<FeatureMetadata, 'id'>>;

export interface FeatureDescriptor {
  readonly meta: FeatureMetadata;
  readonly handler: FeatureHandler;
}

const DEFAULT_INIT_ORDER = 100;

function buildMeta(id: string, input?: FeatureMetadataInput): FeatureMetadata {
  return {
    id,
    name: input?.name ?? id,
    category: input?.category ?? 'misc',
    impact: input?.impact ?? 'light',
    phase: input?.phase ?? 'dom-ready',
    dependencies: input?.dependencies ?? [],
    initOrder: input?.initOrder ?? DEFAULT_INIT_ORDER,
    enabledByDefault: input?.enabledByDefault ?? false,
    requiresDomLayer: input?.requiresDomLayer ?? false,
    cssFiles: input?.cssFiles ?? [],
    settingsKeys: input?.settingsKeys ?? [],
    tags: input?.tags ?? [],
  };
}

export class FeatureRegistry {
  private readonly features = new Map<string, FeatureDescriptor>();

  /**
   * Регистрирует фичу. Повторная регистрация перетирает обработчик, сохраняя
   * ранее заданную метадату, если новая не передана (старый стиль
   * registerMultiple передаёт только handler — метадату навешивают позже через
   * describe()).
   */
  register(id: string, handler: FeatureHandler, meta?: FeatureMetadataInput): void {
    const prev = this.features.get(id);
    const nextMeta = prev
      ? buildMeta(id, { ...prev.meta, ...meta })
      : buildMeta(id, meta);
    this.features.set(id, { handler, meta: nextMeta });
  }

  /** Навешивает/обновляет метадату уже зарегистрированной фичи. */
  describe(id: string, meta: FeatureMetadataInput): void {
    const existing = this.features.get(id);
    if (!existing) {
      console.warn(`[VKify] describe() для незарегистрированной фичи "${id}" — пропущено`);
      return;
    }
    this.features.set(id, {
      handler: existing.handler,
      meta: buildMeta(id, { ...existing.meta, ...meta }),
    });
  }

  has(id: string): boolean {
    return this.features.has(id);
  }

  getFeature(id: string): FeatureDescriptor | undefined {
    return this.features.get(id);
  }

  getHandler(id: string): FeatureHandler | undefined {
    return this.features.get(id)?.handler;
  }

  getMeta(id: string): FeatureMetadata | undefined {
    return this.features.get(id)?.meta;
  }

  /** Все фичи, отсортированные по initOrder, затем по id (детерминированно). */
  getAll(): FeatureDescriptor[] {
    return [...this.features.values()].sort(
      (a, b) => a.meta.initOrder - b.meta.initOrder || a.meta.id.localeCompare(b.meta.id),
    );
  }

  getByCategory(category: FeatureCategory): FeatureDescriptor[] {
    return this.getAll().filter((d) => d.meta.category === category);
  }

  getByImpact(impact: FeatureImpact): FeatureDescriptor[] {
    return this.getAll().filter((d) => d.meta.impact === impact);
  }

  getByTag(tag: string): FeatureDescriptor[] {
    return this.getAll().filter((d) => d.meta.tags.includes(tag));
  }

  /** Фичи с enabledByDefault === true (декларативно, не рантайм-состояние). */
  getEnabled(): FeatureDescriptor[] {
    return this.getAll().filter((d) => d.meta.enabledByDefault);
  }

  forEach(cb: (descriptor: FeatureDescriptor) => void): void {
    for (const descriptor of this.features.values()) cb(descriptor);
  }

  get size(): number {
    return this.features.size;
  }

  /**
   * Топологическая сортировка набора фич по их зависимостям с детерминированным
   * тай-брейком по initOrder/id. Зависимость, не входящая в набор `ids` (или
   * незарегистрированная), пропускается с предупреждением — FeatureManager не
   * включает фичи в обход пользовательских настроек.
   *
   * @param ids активируемый набор; по умолчанию — все зарегистрированные фичи.
   * @returns ids в безопасном порядке инициализации (зависимости раньше зависящих).
   */
  resolveDependencies(ids?: Iterable<string>): string[] {
    const set = new Set<string>();
    for (const id of ids ?? this.features.keys()) {
      if (this.features.has(id)) set.add(id);
    }

    // Топология — общий toposort (core/util). Узлами считаются только id из
    // активируемого набора; зависимость вне набора пропускается, а тип пропуска
    // (незарегистрирована / не активируется) различается в onSkippedDep —
    // FeatureManager не включает фичи в обход пользовательских настроек.
    return topoSort([...set], {
      deps: (id) => this.features.get(id)!.meta.dependencies,
      resolveDep: (dep) => (set.has(dep) ? dep : undefined),
      compare: (a, b) => this.compare(a, b),
      key: (id) => id,
      onSkippedDep: (id, dep) => {
        if (!this.features.has(dep)) {
          console.warn(`[VKify] Фича "${id}" зависит от незарегистрированной "${dep}"`);
        } else {
          console.warn(`[VKify] Фича "${id}" зависит от "${dep}", которая не активируется`);
        }
      },
      onCycle: (id) =>
        console.warn(`[VKify] Обнаружен цикл зависимостей фич на "${id}" — связь проигнорирована`),
    });
  }

  /**
   * Разрешает зависимости набора `ids` (см. resolveDependencies), затем стабильно
   * разбивает результат по фазам в порядке PHASE_ORDER. Внутри каждой фазы
   * сохраняется безопасный по зависимостям порядок.
   *
   * Если фича объявлена в более ранней фазе, чем её зависимость (напр. dom-ready
   * фича зависит от late-фичи), порядок инициализации был бы нарушен. Вместо того
   * чтобы молча его сломать, фича ПОДНИМАЕТСЯ в фазу зависимости (с warning'ом) —
   * так инвариант «зависимость активируется не позже зависящей» соблюдается всегда.
   * Поскольку `ordered` уже dependency-safe, зависимость обрабатывается раньше, и
   * её итоговая (возможно поднятая) фаза известна к моменту обработки зависящей.
   *
   * @returns словарь `{ [phase]: orderedIds }`; присутствуют все фазы (возможно пустые).
   */
  resolveByPhase(ids?: Iterable<string>): Record<FeaturePhase, string[]> {
    const ordered = this.resolveDependencies(ids);

    const buckets: Record<FeaturePhase, string[]> = {
      'early-css': [],
      'dom-ready': [],
      'late': [],
    };
    /** Итоговая фаза фичи после возможного продвижения за зависимостями. */
    const effectivePhase = new Map<string, FeaturePhase>();

    for (const id of ordered) {
      const meta = this.features.get(id)!.meta;
      let phaseIdx = PHASE_ORDER.indexOf(meta.phase);

      for (const dep of meta.dependencies) {
        const depPhase = effectivePhase.get(dep);
        if (!depPhase) continue;
        const depIdx = PHASE_ORDER.indexOf(depPhase);
        if (depIdx > phaseIdx) {
          console.warn(
            `[VKify] Фича "${id}" (${meta.phase}) поднята в фазу "${PHASE_ORDER[depIdx]}", ` +
            `т.к. зависит от "${dep}" (${depPhase}) — иначе нарушился бы порядок инициализации`,
          );
          phaseIdx = depIdx;
        }
      }

      const phase = PHASE_ORDER[phaseIdx];
      effectivePhase.set(id, phase);
      buckets[phase].push(id);
    }

    return buckets;
  }

  private compare(a: string, b: string): number {
    const ma = this.features.get(a)!.meta;
    const mb = this.features.get(b)!.meta;
    return ma.initOrder - mb.initOrder || a.localeCompare(b);
  }
}
