import { widgetIcon } from '@/content/ui/widget-icons.js';

/** Keep inline track feedback short; the full message stays in the tooltip/job. */
export function compactTrackProgress(text: string, kind: 'load' | 'done' | 'err'): string {
  if (kind === 'done') return '';
  if (kind === 'err') return '!';
  const segments = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (segments && Number(segments[2]) > 0) {
    return `${Math.min(100, Math.round(Number(segments[1]) / Number(segments[2]) * 100))}%`;
  }
  const percentage = text.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (percentage) return `${Math.min(100, Math.round(Number(percentage[1].replace(',', '.'))))}%`;
  return '…';
}

export function renderCompactTrackProgress(target: HTMLElement, text: string, kind: 'load' | 'done' | 'err'): void {
  if (kind === 'done') target.replaceChildren(widgetIcon('check', 12));
  else target.textContent = compactTrackProgress(text, kind);
}
