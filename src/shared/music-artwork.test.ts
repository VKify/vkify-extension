import { describe, expect, it } from 'vitest';
import { apiArtwork, musicArtworkUrl, tupleArtwork } from './music-artwork.js';
describe('track artwork', () => {
  it('selects the largest valid cover only for the requested track', () => {
    const response = { response: [{ owner_id: -1, id: 2, album: { thumb: { photo_600: 'https://example.com/large', photo_135: 'https://example.com/small' } } }] };
    expect(apiArtwork(response, '-1_2')).toBe('https://example.com/large');
    expect(apiArtwork(response, '-1_3')).toBe('');
    expect(apiArtwork({ error: {} }, '-1_2')).toBe('');
  });
  it('validates player URLs and ignores unsafe sources', () => {
    const tuple = Array(15).fill(null); tuple[14] = 'https://example.com/small,https://example.com/large';
    expect(tupleArtwork(tuple)).toBe('https://example.com/large');
    for (const url of ['javascript:alert(1)', 'http://example.com/image', 'https://user:secret@example.com/image', null]) expect(musicArtworkUrl(url)).toBe('');
  });
});
