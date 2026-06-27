/**
 * Владелец статических CSS-маркеров `data-vkify-<id>` на <html>.
 *
 * Вынесен из FeatureManager (тот стал god-фасадом). Инкапсулирует и набор
 * активных маркеров, и его зеркало в localStorage (для мгновенного применения
 * на следующей загрузке до первой отрисовки — см. css-marker-mirror.ts).
 *
 * Статические CSS-фичи не инжектят <style> из JS: их правила лежат в colocated
 * `.css` (агрегируются в styles/features.css и грузятся манифестом), а маркер
 * лишь включает/выключает соответствующие селекторы — ровно как тема переключает
 * data-vkify-theme-radius и т.п.
 */

import { reconcileCssMarkers, syncCssMarkerMirror } from './css-marker-mirror.js';

export class CssMarkerManager {
  private readonly active = new Set<string>();

  /** Ставит маркер `data-vkify-<id>` на <html> и освежает зеркало. */
  enable(id: string): void {
    document.documentElement.setAttribute(`data-vkify-${id}`, 'true');
    this.active.add(id);
    syncCssMarkerMirror(this.active);
  }

  /** Снимает маркер `data-vkify-<id>` и освежает зеркало. */
  disable(id: string): void {
    document.documentElement.removeAttribute(`data-vkify-${id}`);
    this.active.delete(id);
    syncCssMarkerMirror(this.active);
  }

  /** Число активных маркеров — для телеметрии производительности. */
  count(): number {
    return this.active.size;
  }

  /**
   * Сверяет маркеры, выставленные синхронно из (возможно устаревшего) зеркала на
   * document_start, с реально активным набором: лишние снимает и перезаписывает
   * зеркало под следующую загрузку. Вызывается из FeatureManager.init() после
   * того, как storage стал источником истины.
   */
  reconcile(): void {
    reconcileCssMarkers(this.active);
  }
}
