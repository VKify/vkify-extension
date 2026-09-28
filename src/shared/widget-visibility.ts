import { WIDGET_CATALOG, parseWidget, widgetKey, widgetDefinition, type WidgetDefinition } from './widget-stack.js';
export const DOWNLOAD_CENTER_OPEN = 'downloadCenterOpen';
const outputIsWidget = (w: WidgetDefinition, values: Record<string, unknown>): boolean =>
  !!w.settingsKey && w.parseSettings?.(values[w.settingsKey]).output === 'widget';
export function widgetIsVisible(id: string, feature: string, values: Record<string, unknown>): boolean {
  const w = widgetDefinition(id, feature);
  if (!parseWidget(values[widgetKey(id)]).visible || (w.feature && values[w.feature] !== true)) return false;
  if (w.visibility && !w.visibility(values)) return false;
  if (w.preset === 'output-widget') return outputIsWidget(w, values);
  if (w.panelKey) return w.panelDefaultOpen ? values[w.panelKey] !== false : values[w.panelKey] === true;
  return true;
}
export function widgetFeatureIsEnabled(id: string, feature: string, values: Record<string, unknown>): boolean {
  const w = widgetDefinition(id, feature);
  if (values[w.feature] !== true) return false;
  return w.preset === 'output-widget' && !outputIsWidget(w, values) || widgetIsVisible(id, feature, values);
}
export function widgetVisibilityPatch(id: string, feature: string, visible: boolean, values: Record<string, unknown>): Record<string, unknown> {
  const w = widgetDefinition(id, feature);
  const patch: Record<string, unknown> = { [widgetKey(id)]: { ...parseWidget(values[widgetKey(id)]), visible } };
  if (w.feature && (!w.preserveFeatureOnClose || visible)) patch[w.feature] = visible;
  if (w.panelKey) patch[w.panelKey] = visible;
  if (visible && w.preset === 'output-widget' && w.settingsKey) patch[w.settingsKey] = JSON.stringify({ ...w.parseSettings?.(values[w.settingsKey]), output: 'widget' });
  return patch;
}
export function musicFeatureVisibilityPatch(id: string, visible: boolean, values: Record<string, unknown>): Record<string, unknown> {
  return withWidgetVisibility(values, { [widgetDefinition(id).feature]: visible });
}
export function musicSettingsVisibilityPatch(id: string, serialized: string, values: Record<string, unknown>): Record<string, unknown> {
  const key = widgetDefinition(id).settingsKey;
  return key ? withWidgetVisibility(values, { [key]: serialized }) : {};
}
export function withWidgetVisibility(current: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const result = { ...patch };
  const next = { ...current, ...patch };
  // A runtime position write (including reset) supersedes pending page migration.
  for (const [key, value] of Object.entries(patch)) {
    if (key.startsWith('widget:') && value && typeof value === 'object' && 'position' in value) {
      const marker = `widgetPositionMigration:${key.slice(7)}`;
      if (current[marker]) result[marker] = false;
    }
  }
  for (const w of WIDGET_CATALOG) {
    if (w.feature && !w.preserveFeatureOnClose && typeof patch[w.feature] === 'boolean') {
      const visible = patch[w.feature] === true;
      result[widgetKey(w.id)] = { ...parseWidget(next[widgetKey(w.id)]), visible };
      if (w.panelKey) result[w.panelKey] = visible;
    }
    if (w.settingsKey && w.settingsKey in patch && next[w.feature] === true && outputIsWidget(w, next)) {
      result[widgetKey(w.id)] = { ...parseWidget(next[widgetKey(w.id)]), visible: true };
    }
  }
  return result;
}
