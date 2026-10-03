/** Decode one layer of HTML entities while preserving literal markup as text. */
export function decodeHtmlEntities(value: string): string {
  let decoder: HTMLTextAreaElement | undefined;
  return value.replace(/&(?:#\d+|#x[\da-f]+|[a-z][\da-z]*);/gi, entity => {
    decoder ??= document.createElement('textarea');
    // Only an entity token reaches the parser; metadata itself is never HTML.
    decoder.innerHTML = entity;
    return decoder.value;
  });
}
