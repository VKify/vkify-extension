/**
 * Эквалайзер (10-полосный Web Audio EQ над плеером VK).
 *
 * Контент-фича-«мост» (ванильный TS): сам DSP живёт в page-world
 * (injected/equalizer.ts), а здесь — связка настроек ↔ страницы ↔ UI:
 *   • инжектит page-world скрипт и пересылает ему {enabled, preamp, bands};
 *   • вставляет кнопку быстрого доступа в плеер (button.ts);
 *   • кнопка открывает плавающую панель управления (panel.ts).
 *
 * audio_equalizer — мастер-тумблер (= id фичи): FeatureManager сам зовёт
 * enable()/disable() при переключении настройки в попапе.
 */
import type { FeatureContext } from '@/content/core/feature-context.js';
import type { FeatureMap } from '@/types/index.js';
import { InjectedScript } from '@/content/core/injected-scripts.js';
import { waitForInjectedScript } from '@/content/utils/injected-ready.js';
import { FLAT_BANDS, normalizeBands, clampGain } from './presets.js';
import { ensureEqualizerStyles, removeEqualizerStyles } from './styles.js';
import { injectEqualizerButton, removeEqualizerButton } from './button.js';
import { togglePanel, openPanel, destroyPanel } from './panel.js';

export function createAudioEqualizerFeature(ctx: FeatureContext): FeatureMap {
  let off: (() => void) | null = null;
  let offStore: (() => void) | null = null;

  // Прочитать актуальные значения из настроек и переслать в page-world DSP.
  async function pushToPage(enabled: boolean): Promise<void> {
    const preamp = clampGain(Number(await ctx.getSetting<number>('audio_equalizer_preamp')) || 0);
    const bands = normalizeBands(await ctx.getSetting<number[]>('audio_equalizer_bands') ?? [...FLAT_BANDS]);
    ctx.sendEvent('vkify:equalizer:update', { enabled, preamp, bands });
  }

  function scanButton(): void {
    injectEqualizerButton(togglePanel);
  }

  return {
    audio_equalizer: {
      reapplyOnNavigate: true,
      reapplyOnLanguageChange: true,

      enable: async () => {
        ensureEqualizerStyles();
        ctx.injectScript(InjectedScript.EQUALIZER);
        await waitForInjectedScript(InjectedScript.EQUALIZER);
        await pushToPage(true);

        scanButton();
        // Плеер перерисовывается на SPA-навигации → возвращаем кнопку.
        off?.();
        off = ctx.observeChanges('audio_equalizer', scanButton);

        // Изменения частот/преампа из попапа → пересылаем в DSP (панель шлёт сама).
        offStore?.();
        offStore = ctx.onStorageChange((key) => {
          if (key === 'audio_equalizer_preamp' || key === 'audio_equalizer_bands') {
            void pushToPage(true);
          }
        });

        // Восстановление панели: если в прошлой сессии была открыта — открыть
        // снова (в сохранённой позиции и состоянии свёрнутости).
        if ((await ctx.getSetting<boolean>('equalizerPanelOpen')) === true) {
          void openPanel();
        }
      },

      disable: () => {
        off?.();
        off = null;
        offStore?.();
        offStore = null;
        ctx.sendEvent('vkify:equalizer:update', { enabled: false });
        destroyPanel();
        removeEqualizerButton();
        removeEqualizerStyles();
      },
    },
  };
}
