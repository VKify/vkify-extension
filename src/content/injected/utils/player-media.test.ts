// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { getPlayerMedia } from './player-media.js';

describe('getPlayerMedia', () => {
  it.each([[156, 1337], [8, 42]])('finds detached VK media with private IDs %s / %s', (nodeId, elementId) => {
    const element = document.createElement('audio');
    const player = { _impl: {
      [`__private_${nodeId}__currentNode`]: { [`__private_${elementId}__element`]: element },
    } };
    expect(element.isConnected).toBe(false);
    expect(getPlayerMedia(player)).toBe(element);
  });

  it.each([1, 2])('finds the new private corePlayer with %s separator underscores', (count) => {
    const element = document.createElement('audio');
    const key = (id: number, name: string) => '__private_' + id + '_'.repeat(count) + name;
    const player = { [key(31, '_corePlayer')]: { [key(42, '_currentNode')]: { [key(53, '_element')]: element } } };
    expect(getPlayerMedia(player)).toBe(element);
  });

  it('supports underscored current nodes and elements without selecting prefetch audio', () => {
    const current = document.createElement('audio');
    const prefetch = document.createElement('audio');
    const impl = { __private_91___currentNode: { __private_182___element: current }, __private_92___prefetchNode: { __private_183___element: prefetch } };
    expect(getPlayerMedia({ _impl: impl })).toBe(current);
    impl.__private_91___currentNode = { __private_182___element: prefetch };
    expect(getPlayerMedia({ _impl: impl })).toBe(prefetch);
    expect(getPlayerMedia({ _impl: { _currentNode: { _element: current } } })).toBe(current);
  });

  it('resolves a replacement current node rather than keeping the previous track', () => {
    const first = document.createElement('audio');
    const second = document.createElement('audio');
    const player = { _impl: { __private_156__currentNode: { __private_1337__element: first } } };
    expect(getPlayerMedia(player)).toBe(first);
    player._impl.__private_156__currentNode = { __private_1337__element: second };
    expect(getPlayerMedia(player)).toBe(second);
  });

  it('supports the legacy player', () => {
    const element = document.createElement('audio');
    expect(getPlayerMedia({ _impl: { _currentAudioEl: { audioElement: element } } })).toBe(element);
  });

  it('never selects prefetched media or unrelated page audio', () => {
    const element = document.createElement('audio');
    document.body.append(element);
    try {
      expect(getPlayerMedia({ _impl: { __private_157__prefetchNode: { __private_1337__element: element } } })).toBeNull();
    } finally { element.remove(); }
  });

  it('does not execute player getters', () => {
    expect(getPlayerMedia({ get _impl() { throw new Error('must not run'); } })).toBeNull();
  });

  it('rejects missing or non-media elements', () => {
    for (const player of [null, undefined, {}, { _impl: { currentNode: { element: {} } } }]) {
      expect(getPlayerMedia(player)).toBeNull();
    }
  });
});
