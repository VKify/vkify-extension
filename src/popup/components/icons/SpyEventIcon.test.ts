import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import SpyEventIcon, { resolveSpyEventIconId } from './SpyEventIcon.js';

describe('spy history SVG icons', () => {
  it.each([
    ['🖼️', 'photo'], ['🖼', 'photo'], ['👤', 'profile'], ['⌨️', 'typing'],
    ['🎤', 'voice'], ['📷', 'photo'], ['🎥', 'video'], ['📎', 'attach'],
    ['📞', 'call'], ['🗑️', 'delete'], ['✏︎', 'edit'], ['👁️', 'read'],
    ['👻', 'hidden'], ['🟢', 'online'], ['⚫', 'offline'],
  ])('renders the old %s representation as the %s SVG', (oldId, expectedId) => {
    expect(resolveSpyEventIconId(oldId)).toBe(expectedId);
    const oldMarkup = renderToStaticMarkup(React.createElement(SpyEventIcon, { id: oldId }));
    const newMarkup = renderToStaticMarkup(React.createElement(SpyEventIcon, { id: expectedId }));
    expect(oldMarkup).toBe(newMarkup);
    expect(oldMarkup).toContain('<svg');
    expect(oldMarkup).not.toContain(oldId);
  });

  it('uses a safe fallback for unknown and missing legacy IDs', () => {
    for (const id of [undefined, '', 'unknown', 'constructor', '__proto__']) {
      expect(resolveSpyEventIconId(id)).toBe('activity');
    }
  });

  it('distinguishes online and offline by both shape and color', () => {
    const online = renderToStaticMarkup(React.createElement(SpyEventIcon, { id: 'online' }));
    const offline = renderToStaticMarkup(React.createElement(SpyEventIcon, { id: 'offline' }));
    expect(online).toContain('text-success');
    expect(offline).toContain('text-[var(--text-tertiary)]');
    const paths = (html: string) => html.match(/<path[^>]+>/g)?.join('');
    expect(paths(online)).toBeTruthy();
    expect(paths(online)).not.toBe(paths(offline));
  });
});
