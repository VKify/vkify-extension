/** Текст-заглушка пустого редактора. Один источник для подсветки и textarea. */
export const CSS_PLACEHOLDER = '/* Введите CSS код... */';

export function highlightCSS(code: string): string {
  if (!code) return '';

  let highlighted = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  highlighted = highlighted.replace(
    /(\/\*[\s\S]*?\*\/)/g,
    '<span class="css-comment">$1</span>'
  );

  highlighted = highlighted.replace(
    /^([^{}\/]+?)(\s*\{)/gm,
    '<span class="css-selector">$1</span>$2'
  );

  highlighted = highlighted.replace(
    /(\s*)([\w-]+)(\s*:)/g,
    '$1<span class="css-property">$2</span>$3'
  );

  highlighted = highlighted.replace(
    /(!important)/gi,
    '<span class="css-important">$1</span>'
  );

  highlighted = highlighted.replace(
    /(#[0-9a-fA-F]{3,8})/g,
    '<span class="css-color">$1</span>'
  );

  highlighted = highlighted.replace(
    /(\d+\.?\d*)(px|em|rem|%|vh|vw|deg|s|ms)/g,
    '<span class="css-number">$1$2</span>'
  );

  return highlighted;
}

export function getPlaceholderHTML(): string {
  return `<span class="text-[var(--text-tertiary)]">${CSS_PLACEHOLDER}</span>`;
}