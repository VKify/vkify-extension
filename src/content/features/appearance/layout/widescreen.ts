import type { FeatureManager } from '../../../core/feature-manager.js';
import type { FeatureMap } from '../../../../types/index.js';


const MARKER = 'content_width';
const VAR_CSS_ID = 'content_width_var';
const CW_VAR = '--vkify-cw';

const PERSIST_DELAY = 200;

/**
 * Ширина контента VK:
 *   • `content_width_enabled` — boolean-тоггл (главный switch);
 *   • `content_width`         — числовое значение в px.
 */
export function createWidescreenFeatures(manager: FeatureManager): FeatureMap {
  let isEnabled = false;
  let widthValue = 0;
  let markerSet = false;
  let rafId: number | undefined;
  let persistTimer: ReturnType<typeof setTimeout> | undefined;

  // Ширину ограничиваем шириной окна (`min(Vpx, 100vw)`), чтобы на маленьком
  // мониторе/ноутбуке контент не вылезал за край и не появлялся гориз. скролл.
  function varValue(): string {
    return `min(${widthValue}px, 100vw)`;
  }

  function isActive(): boolean {
    return isEnabled && widthValue > 0;
  }

  function persistVar(): void {
    manager.injectCSS(VAR_CSS_ID, `:root { ${CW_VAR}: ${varValue()}; }`);
  }

  function clearPersist(): void {
    if (persistTimer) { clearTimeout(persistTimer); persistTimer = undefined; }
  }

  // Единственное место, где трогаем DOM. persistNow=true (включение/навигация)
  // зеркалит сразу, чтобы reconcile после init() не вычистил запись; во время
  // перетаскивания — с дебаунсом.
  function paint(persistNow: boolean): void {
    if (!isActive()) {
      clearPersist();
      if (markerSet) { manager.disableCss(MARKER); markerSet = false; }
      manager.removeCSS(VAR_CSS_ID);
      document.documentElement.style.removeProperty(CW_VAR);
      return;
    }

    if (!markerSet) { manager.enableCss(MARKER); markerSet = true; }
    document.documentElement.style.setProperty(CW_VAR, varValue());

    if (persistNow) {
      clearPersist();
      persistVar();
    } else if (!persistTimer) {
      persistTimer = setTimeout(() => { persistTimer = undefined; persistVar(); }, PERSIST_DELAY);
    }
  }

  // Коалесинг изменений значения в один кадр.
  function schedulePaint(): void {
    if (rafId !== undefined) return;
    rafId = requestAnimationFrame(() => { rafId = undefined; paint(false); });
  }

  // Немедленная перерисовка (включение/навигация/выключение) — без ожидания кадра.
  function paintNow(): void {
    if (rafId !== undefined) { cancelAnimationFrame(rafId); rafId = undefined; }
    paint(true);
  }

  return {
    content_width_enabled: {
      reapplyOnNavigate: true,

      enable: async () => {
        isEnabled = true;
        // Подтягиваем актуальное значение слайдера — на случай если
        // content_width_enabled инициализируется раньше content_width.
        const stored = await manager.getSetting<number>('content_width');
        if (typeof stored === 'number') widthValue = stored;
        paintNow();
      },

      disable: () => {
        isEnabled = false;
        paintNow();
      },
    },

    content_width: {
      // Только состояние + планирование кадра — никакой работы с DOM на тик.
      enable: (value?: unknown) => {
        if (typeof value === 'number') widthValue = value;
        schedulePaint();
      },
      disable: () => {
        widthValue = 0;
        schedulePaint();
      },
    },
  };
}