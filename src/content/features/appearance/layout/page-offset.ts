import type { FeatureManager } from '@/content/core/feature-manager.js';
import type { FeatureMap } from '@/types/index.js';


const MARKER = 'page_offset';
const VAR_CSS_ID = 'page_offset_var';
const CW_VAR = '--vkify-cw';
const SHIFT_VAR = '--vkify-page-shift';

const FALLBACK_CONTENT_WIDTH = 1000;

const PERSIST_DELAY = 200;

export function createPageOffsetFeature(manager: FeatureManager): FeatureMap {
  let isEnabled   = false;
  let sliderValue = 50;
  let markerSet   = false;
  let rafId: number | undefined;
  let persistTimer: ReturnType<typeof setTimeout> | undefined;

  // Реальная ширина дефолтной раскладки VK (не зависит от монитора). Нужна как
  // запасное значение, когда «Ширина контента» выключена и `--vkify-cw` не задан.
  function measureDefaultWidth(): number {
    const layout = document.getElementById('page_layout');
    const w = layout?.offsetWidth ?? 0;
    return w > 200 ? w : FALLBACK_CONTENT_WIDTH;
  }

  function shiftValue(): string {
    const fraction = (sliderValue - 50) / 50; // −1 … +1
    const fallbackW = measureDefaultWidth();
    return `calc(${fraction} * max(0px, (100vw - var(${CW_VAR}, ${fallbackW}px))) / 2)`;
  }

  function isActive(): boolean {
    return isEnabled && sliderValue !== 50;
  }

  function persistVar(): void {
    manager.injectCSS(VAR_CSS_ID, `:root { ${SHIFT_VAR}: ${shiftValue()}; }`);
  }

  function clearPersist(): void {
    if (persistTimer) { clearTimeout(persistTimer); persistTimer = undefined; }
  }

  // Единственное место, где трогаем DOM. persistNow=true (включение/навигация)
  // зеркалит сразу; во время перетаскивания — с дебаунсом.
  function paint(persistNow: boolean): void {
    if (!isActive()) {
      clearPersist();
      if (markerSet) { manager.disableCss(MARKER); markerSet = false; }
      manager.removeCSS(VAR_CSS_ID);
      document.documentElement.style.removeProperty(SHIFT_VAR);
      return;
    }

    if (!markerSet) { manager.enableCss(MARKER); markerSet = true; }
    document.documentElement.style.setProperty(SHIFT_VAR, shiftValue());

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
    page_offset_enabled: {
      reapplyOnNavigate: true,

      enable: async () => {
        isEnabled = true;
        // Читаем актуальное значение слайдера из кэша хранилища.
        // Это нужно на случай, если page_offset_enabled инициализируется
        // раньше page_offset_value в цикле init() и sliderValue ещё = 50.
        const stored = await manager.getSetting<number>('page_offset_value');
        if (typeof stored === 'number') sliderValue = stored;
        paintNow();
      },

      disable: () => {
        isEnabled = false;
        paintNow();
      },
    },

    page_offset_value: {
      // Только состояние + планирование кадра — никакой работы с DOM на тик.
      enable: (value?: unknown) => {
        if (typeof value === 'number') sliderValue = value;
        schedulePaint();
      },
      disable: () => {
        sliderValue = 0;
        schedulePaint();
      },
    },
  };
}