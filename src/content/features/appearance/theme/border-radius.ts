import type { FeatureContext } from '@/content/core/feature-context.js';
import type { FeatureMap } from '@/types/index.js';
import { AVATAR_ROUNDING_CSS } from './avatar-rounding-styles.js';

/**
 * Фигурные пресеты скругления аватарок. Ключи синхронизированы с
 * AVATAR_SHAPES в попапе (AppearanceTab) и enum'ом avatar_radius_shape
 * в settings-schema.ts. Пустая строка / отсутствие → процент из слайдера.
 */
const SHAPE_RADIUS: Record<string, string> = {
  drop:  '0 50% 50% 50%',
  leaf:  '0 50% 0 50%',
  petal: '50% 0 50% 0',
  blob:  '30% 70% 70% 30% / 30% 30% 70% 70%',
  arch:   '50% 50% 12% 12%',
  shield: '12% 12% 50% 50% / 12% 12% 85% 85%',
  egg:    '50% 50% 45% 45% / 65% 65% 35% 35%',
  pebble: '65% 35% 45% 55% / 55% 45% 35% 65%',
  pillow:   '35% / 25%',
};

export function createBorderRadiusFeature(ctx: FeatureContext): FeatureMap {
  // Единая точка применения: читает оба параметра (процент + фигура),
  // т.к. итоговый border-radius зависит от их комбинации.
  async function apply(): Promise<void> {
    // Точечные чтения из кэша StorageManager — не полный IPC-дамп storage.
    const [percentRaw, shapeRaw] = await Promise.all([
      ctx.getSetting<number>('border_radius'),
      ctx.getSetting<string>('avatar_radius_shape'),
    ]);
    // 50% — нативный вид VK (аватарки и так круглые): CSS не нужен.
    // Любое другое значение, включая явный 0 (квадратные), инжектится.
    const percent = typeof percentRaw === 'number' ? percentRaw : 50;
    const shape = shapeRaw || '';

    const radius = SHAPE_RADIUS[shape] ?? (percent !== 50 ? `${percent}%` : '');
    if (!radius) {
      ctx.removeCSS('border_radius');
      return;
    }
    ctx.injectCSS('border_radius', `:root { --vkify-avatar-radius: ${radius}; }\n${AVATAR_ROUNDING_CSS}`);
  }

  return {
    border_radius: {
      enable: () => apply(),
      disable: () => apply(),
    },
    avatar_radius_shape: {
      enable: () => apply(),
      disable: () => apply(),
    },
  };
}
