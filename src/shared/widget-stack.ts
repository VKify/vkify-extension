export interface WidgetPosition { left: number; top: number }
export interface WidgetState { mode: 'free' | 'stacked'; visible: boolean; order: number }
export interface StackSettings {
  side: 'left' | 'right' | 'free'; vertical: 'top' | 'center' | 'bottom';
  collapsed: boolean; gap: number; width: number; opacity: number; animation: boolean;
  position: WidgetPosition | null;
}
export const definitionKey = (id: string): string => `widgetDefinition:${id}`;
export const isWidgetKey = (key: string): boolean => key === 'widgetStack' || key === 'downloadCenterOpen' || /^(widgetState|widgetPosition|widgetDefinition):/.test(key) || key === 'equalizerPosition' || key === 'perfWidgetPosition';
export const STACK_KEY = 'widgetStack';
export const widgetKey = (id: string): string => `widgetState:${id}`;
export const positionKey = (id: string): string => id === 'equalizer' ? 'equalizerPosition' : id === 'perf-widget' ? 'perfWidgetPosition' : `widgetPosition:${id}`;
export const DEFAULT_STACK: StackSettings = { side: 'right', vertical: 'center', collapsed: false, gap: 16, width: 340, opacity: 1, animation: true, position: null };
export const WIDGET_CATALOG = [
  { id: 'clock', feature: 'clock_enabled' },
  { id: 'equalizer', feature: 'audio_equalizer' },
  { id: 'perf-widget', feature: 'perf_widget' },
  { id: 'download-center', feature: '' },
  { id: 'music-mini-player', feature: 'music_mini_player' },
  { id: 'music_visualizer', feature: 'music_visualizer' },
  { id: 'music_lyrics', feature: 'music_lyrics' },
] as const;
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const number = (v: unknown, fallback: number, min: number, max: number): number => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
export function parsePosition(value: unknown): WidgetPosition | null {
  const v = record(value);
  return typeof v.left === 'number' && Number.isFinite(v.left) && typeof v.top === 'number' && Number.isFinite(v.top) ? { left: v.left, top: v.top } : null;
}
export function parseWidget(value: unknown): WidgetState {
  const v = record(value);
  return { mode: v.mode === 'stacked' ? 'stacked' : 'free', visible: v.visible !== false, order: number(v.order, 0, -100000, 100000) };
}
export function parseStack(value: unknown): StackSettings {
  const v = record(value);
  return {
    side: v.side === 'left' || v.side === 'free' ? v.side : 'right',
    vertical: v.vertical === 'top' || v.vertical === 'bottom' ? v.vertical : 'center',
    collapsed: v.collapsed === true, animation: v.animation !== false,
    gap: number(v.gap, 16, 0, 80), width: number(v.width, 340, 240, 600),
    opacity: number(v.opacity, 1, .4, 1), position: parsePosition(v.position),
  };
}
export function orderedWidgets(ids: string[], values: Record<string, unknown>): string[] {
  return ids.sort((a, b) => parseWidget(values[widgetKey(a)]).order - parseWidget(values[widgetKey(b)]).order || a.localeCompare(b));
}
/** Reorder all members, including temporarily closed widgets. One atomic local write. */
export function reorderWidgets(ids: string[], moved: string, target: string, values: Record<string, unknown>): Record<string, WidgetState> {
  const order = orderedWidgets([...ids], values);
  const from = order.indexOf(moved), to = order.indexOf(target);
  if (from < 0 || to < 0) return {};
  order.splice(from, 1); order.splice(to, 0, moved);
  return Object.fromEntries(order.map((id, index) => [widgetKey(id), { ...parseWidget(values[widgetKey(id)]), order: index }]));
}
