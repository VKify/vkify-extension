import { scriptPlugin, type FeatureDefinition } from '@/content/core/features/index.js';
import { InjectedScript } from '../../core/injected-scripts.js';
import { waitForInjectedScript } from '../../utils/injected-ready.js';

/*
 * Анти-трекинг (prevent_typing / prevent_read) — bespoke плагинные фичи.
 *
 * Поведение собрано из переиспользуемого `scriptPlugin` (инъекция page-world
 * скрипта ANTI_TRACKING, идемпотентно для обеих фич) + init/destroy, которые
 * синхронизируют конкретную настройку в скрипт через CustomEvent. Скрипт нельзя
 * «раз-инъектировать», поэтому выключение — это sendEvent с false (destroy), а не
 * снятие скрипта.
 */
function antiTrackingFeature(id: string, name: string): FeatureDefinition {
  return {
    id,
    name,
    category: 'privacy',
    tags: ['anti-tracking'],
    plugins: [scriptPlugin(InjectedScript.ANTI_TRACKING)],
    init: (ctx) => {
      // Не ждём синхронно (скрипт может не сигналить) — fire-and-forget, как раньше.
      void waitForInjectedScript(InjectedScript.ANTI_TRACKING).then(() => {
        ctx.sendEvent('vkify-update-settings', { [id]: true });
      });
    },
    destroy: (ctx) => {
      ctx.sendEvent('vkify-update-settings', { [id]: false });
    },
  };
}

export const preventTypingFeature = antiTrackingFeature('prevent_typing', 'Не показывать набор текста');
export const preventReadFeature = antiTrackingFeature('prevent_read', 'Не отправлять прочтения');

export const antiTrackingFeatures: readonly FeatureDefinition[] = [
  preventTypingFeature,
  preventReadFeature,
];