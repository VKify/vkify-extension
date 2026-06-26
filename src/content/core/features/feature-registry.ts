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

export interface FeatureMetadata {
  readonly id: string;
  /** Человекочитаемое имя (для интроспекции/логов). */
  readonly name: string;
  readonly category: FeatureCategory;
  readonly impact: FeatureImpact;
  /** id других фич, которые должны быть включены раньше этой. */
  readonly dependencies: readonly string[];
  /** Порядок инициализации внутри resolveDependencies (меньше — раньше). */
  readonly initOrder: number;
  /** Включена ли фича по умолчанию (для справки/интроспекции). */
  readonly enabledByDefault: boolean;
  /** Опирается ли фича на централизованный DOM-слой (observer/selectors). */
  readonly requiresDomLayer: boolean;
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
    dependencies: input?.dependencies ?? [],
    initOrder: input?.initOrder ?? DEFAULT_INIT_ORDER,
    enabledByDefault: input?.enabledByDefault ?? false,
    requiresDomLayer: input?.requiresDomLayer ?? false,
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

    const roots = [...set].sort((a, b) => this.compare(a, b));
    const result: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (id: string): void => {
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        console.warn(`[VKify] Обнаружен цикл зависимостей фич на "${id}" — связь проигнорирована`);
        return;
      }
      visiting.add(id);

      for (const dep of this.features.get(id)!.meta.dependencies) {
        if (!this.features.has(dep)) {
          console.warn(`[VKify] Фича "${id}" зависит от незарегистрированной "${dep}"`);
          continue;
        }
        if (!set.has(dep)) {
          console.warn(`[VKify] Фича "${id}" зависит от "${dep}", которая не активируется`);
          continue;
        }
        visit(dep);
      }

      visiting.delete(id);
      visited.add(id);
      result.push(id);
    };

    for (const id of roots) visit(id);
    return result;
  }

  private compare(a: string, b: string): number {
    const ma = this.features.get(a)!.meta;
    const mb = this.features.get(b)!.meta;
    return ma.initOrder - mb.initOrder || a.localeCompare(b);
  }
}
