import { describe, it, expect } from 'vitest';
import { readNextTrack } from './player-queue.js';
const a = [1, 7, '', 'A', 'Artist'];
const b = [2, 7, '', 'B', 'Artist'];
const c = [3, 7, '', 'C', 'Artist'];
describe('current VK queue', () => {
  it('recovers from unavailable data and re-reads a replaced queue without a track change', () => {
    let queue: unknown = undefined;
    const player = { getCurrentPlaylist: () => queue };
    expect(readNextTrack(player, '7_1')).toBeNull();
    queue = { audios: [a, b] };
    expect(readNextTrack(player, '7_1')?.title).toBe('B');
    queue = { audios: [a, c] };
    expect(readNextTrack(player, '7_1')?.title).toBe('C');
    queue = { audios: [a] };
    expect(readNextTrack(player, '7_1')).toBeNull();
  });
  it('supports modern next-track objects and rejects missing current tracks', () => {
    expect(readNextTrack({ getNextAudio: () => ({ id: 2, owner_id: 7, title: 'B', artist: 'Artist' }) }, '7_1')?.id).toBe('7_2');
    expect(readNextTrack({ _currentPlaylist: { list: [b,c] } }, '7_1')).toBeNull();
    expect(readNextTrack({ _shuffle: true, _currentPlaylist: [a,b] }, '7_1')).toBeNull();
  });
  it('falls back when an optional accessor throws', () => {
    expect(readNextTrack({ getNextAudio: () => { throw new Error('not ready'); }, _currentPlaylist: { list: [a,b] } }, '7_1')?.title).toBe('B');
  });
});
