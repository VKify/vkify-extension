/** Shared drag handles and drop markers for popup lists and VK widgets. */
export const REORDER_CSS = `
.vkify-reorder-row { position: relative; }
button.vkify-reorder-handle { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 24px; height: 28px; padding: 0; border: 0; border-radius: 4px; background: transparent; color: var(--text-secondary, var(--vkui--color_text_secondary, #818c99)); cursor: grab; touch-action: none; }
button.vkify-reorder-handle:active { cursor: grabbing; }
button.vkify-reorder-handle[hidden] { display: none; }
button.vkify-reorder-handle:focus-visible, button.vkify-reorder-button:focus-visible { outline: 2px solid var(--primary, var(--vkui--color_stroke_accent, #5181b8)); outline-offset: -2px; }
button.vkify-reorder-button { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 28px; height: 28px; padding: 0; border: 1px solid var(--border-color, var(--vkui--color_separator_primary, #dce1e6)); border-radius: 8px; color: var(--text-secondary, var(--vkui--color_text_secondary, #818c99)); background: var(--bg-primary, var(--vkui--color_background_content, #fff)); cursor: pointer; }
button.vkify-reorder-button:hover:not(:disabled) { background: var(--bg-secondary, var(--vkui--color_background_secondary, #f5f5f5)); }
button.vkify-reorder-button:disabled { opacity: .25; cursor: default; }
.vkify-reorder-row[data-dragging] { opacity: .5; }
.vkify-reorder-row[data-drop]::after { content: ''; position: absolute; left: 8px; right: 8px; height: 2px; z-index: 2; background: var(--primary, var(--vkui--color_text_accent, #2688eb)); pointer-events: none; }
.vkify-reorder-row[data-drop="before"]::after { top: 0; }
.vkify-reorder-row[data-drop="after"]::after { bottom: 0; }
`;
