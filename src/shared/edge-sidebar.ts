export const EDGE_SIDEBAR_BACKGROUNDS = ['theme', 'custom', 'transparent'] as const;

export const EDGE_SIDEBAR_DEFAULTS = {
  edge_sidebar_width: 0, // Automatic responsive width.
  edge_sidebar_background: 'theme',
  edge_sidebar_color: '#1f2937',
  edge_sidebar_opacity: 100,
  edge_sidebar_blur: 0,
  edge_sidebar_item_radius: 8,
  edge_sidebar_item_height: 38,
} as const;

export function isEdgeSidebarColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}
