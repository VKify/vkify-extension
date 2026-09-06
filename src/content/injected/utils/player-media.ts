// VK's compiled private-field numbers change between bundles. Read only the
// named current node, never the prefetch node or unrelated media on the page.
function readField(owner: unknown, name: string): unknown {
  if (!owner || typeof owner !== 'object') return undefined;
  const fields = Object.getOwnPropertyDescriptors(owner);
  const direct = fields[name];
  if (direct && 'value' in direct) return direct.value;
  const privateName = Object.keys(fields).find((key) =>
    new RegExp(`^__private_\\d+__${name}$`).test(key));
  const field = privateName ? fields[privateName] : undefined;
  return field && 'value' in field ? field.value : undefined;
}

export function getPlayerMedia(player: unknown): HTMLMediaElement | null {
  const impl = readField(player, '_impl');
  const node = readField(impl, 'currentNode');
  const element = readField(node, 'element');
  if (element instanceof HTMLMediaElement) return element;

  // Older VK player implementations remain supported.
  const legacy = readField(readField(impl, '_currentAudioEl'), 'audioElement');
  return legacy instanceof HTMLMediaElement ? legacy : null;
}
