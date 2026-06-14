/**
 * Оформление VK: тема/акцент/радиус/прозрачность/стекло/глубина.
 * Модули: palette (цветовая математика) · vars (CSS-переменные) · feature
 * (регистрация и применение к DOM). Палитра/переменные переиспользуются
 * мгновенным зеркалом темы (theme/mirror) до инициализации FeatureManager.
 */

export { createThemeFeatures } from './feature.js';

export {
  generateThemePalette, generateAccentPalette, clamp,
} from './palette.js';

export {
  themePaletteToVars, accentPaletteToVars,
  THEME_VAR_NAMES, ACCENT_VAR_NAMES,
} from './vars.js';
