/** Negative layers share body's stacking context: theme → wallpaper → effect → VK UI.
 * Isolation paints them above the body's own theme color without raising them over
 * ordinary (even unpositioned) VK content. Neither feature supplies a page color.
 */
export const BACKGROUND_LAYERS = { wallpaper: -3, visualizer: -2, lyrics: -1, vignette: -1 } as const;

// Both independent features own a copy of this CSS. Disabling one therefore does
// not remove the stacking context or opaque-layout fixes needed by the other.
export const BACKGROUND_LAYERS_CSS = `
  body { isolation: isolate; }
  .scroll_fix, #layout_wrapper_root, .ProfileWrapper__root { background: transparent !important; }
`;

/** The startup CSS mirror can create this host before <body> exists. */
export function attachWallpaperToBody(): void {
  const host = document.getElementById('vkify-bg-container');
  if (host && document.body && host.parentElement !== document.body) document.body.prepend(host);
}
