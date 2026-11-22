// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { findTrackRoots, vkuiRowToEntry, playerToEntry, trackCache } from './dom.js';
import { queryAll, safeQuerySelector } from '@/content/core/dom/query.js';
import { SELECTORS } from '@/content/selectors/index.js';

afterEach(() => { document.body.innerHTML = ''; trackCache.clear(); });

it('reads current player metadata at click time and keeps simultaneous players separate', () => {
  const player = (id: string) => `<section><img src="https://example.com/cover.jpg?type=audio"><a href="/audio${id}">Current track</a><a href="/artist/1">First</a><a href="/artist/2">Second</a><div><div role="group"><button><svg class="vkuiIcon--music_note_wave_outline_24"></svg></button></div></div></section>`;
  document.body.innerHTML = player('-1_2') + player('3_4') + '<div data-audio-id="99_99"><a href="/audio99_99">Queue track</a></div>';
  const groups = document.querySelectorAll('[role="group"]');
  expect(playerToEntry(groups[0])).toMatchObject({ trackId: '-1_2', title: 'Current track', performer: 'First, Second', coverUrl: 'https://example.com/cover.jpg?type=audio', audioData: [2, -1] });
  expect(playerToEntry(groups[1])?.trackId).toBe('3_4');
  document.querySelector('a[href="/audio-1_2"]')!.setAttribute('href', '/audio-5_6');
  expect(playerToEntry(groups[0])?.trackId).toBe('-5_6');
  document.querySelector('section')!.innerHTML = '<div role="group"></div>';
  expect(playerToEntry(document.querySelector('[role="group"]')!)).toBeNull();
});

it('still reads a legacy player with its explicit title and artist markers', () => {
  document.body.innerHTML = '<div data-testid="AudioPage_PlayerBlock"><a data-testid="AudioPlayerBlock_AudioTitle" href="/audio-7_8">Legacy</a><a data-testid="AudioPlayerBlock_Authors">Artist</a></div>';
  expect(playerToEntry()).toMatchObject({ trackId: '-7_8', title: 'Legacy', performer: 'Artist' });
});

it('reads November 2026 cells without test IDs or readable classes', () => {
  document.body.innerHTML = `<div data-testentitytag="audio" data-audio-id="822543105_456239143">
    <div aria-disabled="false"><img src="https://example.com/cover.jpg?type=audio">
      <div><a href="/audio-2001262059_156262059">Deep Love</a>
        <a href="/artist/6032082478339162577">CRASPORE</a><a href="/audio">Guest</a></div>
      <div><span>3:40</span></div>
    </div></div>`;
  const roots = findTrackRoots();
  expect(roots).toHaveLength(1);
  expect(queryAll(SELECTORS.music.vkuiRoot)).toEqual(roots);
  expect(vkuiRowToEntry(roots[0])).toMatchObject({
    trackId: '822543105_456239143', title: 'Deep Love', performer: 'CRASPORE, Guest',
    coverUrl: 'https://example.com/cover.jpg?type=audio',
  });
});

it('finds the upload anchor without test IDs', () => {
  document.body.innerHTML = '<div role="group"><button aria-label="Загрузить аудиозапись"></button></div>';
  expect(safeQuerySelector(SELECTORS.music.uploadVkBtn)?.closest('[role="group"]')).not.toBeNull();
});
