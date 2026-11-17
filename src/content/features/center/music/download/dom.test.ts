// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { findTrackRoots, vkuiRowToEntry, trackCache } from './dom.js';
import { queryAll, safeQuerySelector } from '@/content/core/dom/query.js';
import { SELECTORS } from '@/content/selectors/index.js';

afterEach(() => { document.body.innerHTML = ''; trackCache.clear(); });

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
