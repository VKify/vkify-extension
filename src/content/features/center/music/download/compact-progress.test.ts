import { describe, expect, it } from 'vitest';
import { compactTrackProgress } from './compact-progress.js';

describe('compact inline audio progress', () => {
  it('formats both translated segment counters and conversion progress', () => {
    expect(compactTrackProgress('Сегменты 11 / 12', 'load')).toBe('92%');
    expect(compactTrackProgress('Segments 1 / 2000', 'load')).toBe('0%');
    expect(compactTrackProgress('Конвертация 87%', 'load')).toBe('87%');
    expect(compactTrackProgress('Encoding 87.5%', 'load')).toBe('88%');
  });
  it('handles unknown phases, empty counters, completion and long errors', () => {
    expect(compactTrackProgress('Подключение', 'load')).toBe('…');
    expect(compactTrackProgress('Segments 0 / 0', 'load')).toBe('…');
    expect(compactTrackProgress('Segments 13 / 12', 'load')).toBe('100%');
    expect(compactTrackProgress('Сохранено', 'done')).toBe('');
    expect(compactTrackProgress('Download failed: a long server error', 'err')).toBe('!');
  });
});
