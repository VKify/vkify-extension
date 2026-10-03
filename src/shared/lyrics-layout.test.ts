import { expect, it } from 'vitest';
import { lyricsPageOffsetPatch, musicPageOffsetPatch, musicOverlayArea } from './lyrics-layout.js';
import { lyricsPreset, parseLyricsSettings, LYRICS_PRESETS } from './music-lyrics.js';
import { visualizerPreset } from './music-visualizer.js';
import type { VisualizerSettings } from './music-visualizer.js';

it.each<[string, Partial<VisualizerSettings>]>([
  ['left', { lyricsAlignment: 'left' }],
  ['center', { lyricsAlignment: 'center' }],
  ['right', { lyricsAlignment: 'right' }],
  ['moved right', { lyricsAlignment: 'left', offsetX: 60 }],
  ['moved back left', { lyricsAlignment: 'right', offsetX: -70 }],
  ['narrow right column', { lyricsAlignment: 'center', width: 38, offsetX: 57 }],
  ['narrow left column', { lyricsAlignment: 'right', width: 38 }],
  ['top', { lyricsAlignment: 'center', position: 'top', offsetY: -20 }],
  ['bottom', { lyricsAlignment: 'right', position: 'bottom', offsetY: 20 }],
])('keeps VK content on the left for %s lyrics positioning', (_, patch) => {
  const settings = parseLyricsSettings({ ...patch, output: 'overlay', lyricsAvoidContent: true, lyricsStyle: 'flow' });
  expect(lyricsPageOffsetPatch(settings)).toEqual({ page_offset_enabled: true, page_offset_value: 0 });
});
it.each(LYRICS_PRESETS.map(p => p.id))('applies %s through the existing Appearance settings', id => {
  const preset = lyricsPreset(id);
  expect(lyricsPageOffsetPatch(preset)).toEqual(id === 'cinema' ? {} : { page_offset_enabled: true, page_offset_value: 0 });
  expect(lyricsPageOffsetPatch({ ...preset, output: 'widget' })).toEqual({});
  expect(lyricsPageOffsetPatch({ ...preset, lyricsAvoidContent: false })).toEqual({});
});

it.each(['orbit', 'echo'])('places %s on the right and the page on the left', id => {
 const value = visualizerPreset(id);
 expect(musicPageOffsetPatch(value)).toEqual({page_offset_enabled:true, page_offset_value:0});
 expect(musicPageOffsetPatch({...value, offsetX:-20}).page_offset_value).toBe(0);
 expect(musicPageOffsetPatch({...value, output:'widget'})).toEqual({});
 expect(musicPageOffsetPatch({...value, visualizerAvoidContent:false})).toEqual({});
});
it('does not change Appearance settings for other visualizers',()=> {
 expect(musicPageOffsetPatch(visualizerPreset('neon'))).toEqual({});
});
it.each(LYRICS_PRESETS.map(p=>p.id))('keeps VK content on the left for %s', id=> {
 expect(lyricsPageOffsetPatch(lyricsPreset(id)).page_offset_value).toBe(id === 'cinema' ? undefined : 0);
});
it.each([1366,1920,2560])('fits the effect beside actual content at %s pixels', width=> {
 const right=musicOverlayArea(width,768,{left:0,right:1000})!;
 expect(right.x).toBeGreaterThanOrEqual(1000);
 expect(right.x+right.width).toBeLessThanOrEqual(width);
 const left=musicOverlayArea(width,768,{left:width-1000,right:width})!;
 expect(left.x+left.width).toBeLessThanOrEqual(width-1000);
});
it('does not invent vertical space in a full-width layout',()=> {
 expect(musicOverlayArea(800,600,{left:0,right:800})).toBeNull();
});
