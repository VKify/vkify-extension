/** Only VKify-owned markers; no VK component names, hashes or test IDs. */
export const AVATAR_ROUNDING_CSS = `
[data-vkify-avatar-surface] { border-radius: var(--vkify-avatar-radius) !important; }
[data-vkify-avatar-clip] { clip-path: inset(0 round var(--vkify-avatar-radius)) !important; }
[data-vkify-avatar-ring] {
  clip-path: none !important;
  border-radius: var(--vkify-avatar-radius) !important;
  box-sizing: border-box !important;
  padding: var(--vkify-avatar-ring-width) !important;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0) !important;
  mask-composite: exclude !important;
}
`;
