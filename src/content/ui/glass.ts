/** Общая полупрозрачная поверхность встроенных окон VKify. */
export const GLASS_SURFACE_CSS = `
  background: var(--vkui--color_background_modal, var(--vkui--color_background_content, #fff));
  background: color-mix(in srgb, var(--vkui--color_background_modal, var(--vkui--color_background_content, #fff)) 82%, transparent);
  -webkit-backdrop-filter: blur(18px) saturate(125%);
  backdrop-filter: blur(18px) saturate(125%);
  border: 1px solid color-mix(in srgb, var(--vkui--color_text_primary, #19191a) 12%, transparent);
`;
