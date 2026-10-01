import { describe, expect, it } from 'vitest';
import { isNewerVersion, readReleaseVersion } from './extension-update.js';
describe('release selection', () => {
  it.each([
    ['v1.10.0', '1.9.9', true], ['1.8.6', '1.8.6', false], ['1.8.5', '1.8.6', false],
    ['1.8.6.1', '1.8.6', true], ['1.8.6-beta', '1.8.6', false], ['1.8.6', '1.8.6.0', false],
  ])('compares %s with %s', (a, b, expected) => { expect(isNewerVersion(a, b)).toBe(expected); });
  it.each([
    { tag_name: 'v1.9.0', prerelease: true, assets: [{ name: 'vkify.xpi' }] },
    { tag_name: 'v1.9.0', draft: true, assets: [{ name: 'vkify.xpi' }] },
    { tag_name: 'v1.9.0', assets: [{ name: 'firefox.zip' }] },
    { tag_name: 'v1.9.0-beta', assets: [{ name: 'vkify.xpi' }] },
  ])('rejects releases that cannot be installed as a stable Firefox update', value => {
    expect(() => readReleaseVersion(value)).toThrow();
  });
});
