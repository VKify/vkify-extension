export function formatCSS(code: string): string {
  if (!code.trim()) return '';

  return code
    .replace(/\s+/g, ' ')
    .replace(/\{\s*/g, ' {\n  ')
    .replace(/;\s*/g, ';\n  ')
    .replace(/\s*\}/g, '\n}')
    .replace(/\}\s*/g, '}\n\n')
    .replace(/  \n/g, '\n')
    .replace(/\n\n\n+/g, '\n\n')
    .trim();
}

export function getLineWord(count: number): string {
  if (count === 1) return 'строка';
  if (count >= 2 && count <= 4) return 'строки';
  return 'строк';
}