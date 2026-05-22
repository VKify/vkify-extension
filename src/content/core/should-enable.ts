/**
 * Определяет, должна ли фича быть активирована по значению из storage.
 *
 * Вынесена в отдельный файл для unit-тестирования без browser API.
 * FeatureManager использует эту же функцию через импорт.
 */
export function shouldEnable(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'number' && value > 0) return true;
  if (typeof value === 'string' && value !== '') return true;
  if (Array.isArray(value) && value.length > 0) return true;
  return false;
}