import { describe, expect, it } from 'vitest';
import { VisualizerRenderer, SILENT_ANALYSIS, visualizerPlacement, VISUALIZER_RENDERERS } from './visualizer-renderer.js';
import { parseVisualizerSettings, visualizerPreset, VISUALIZER_MODES } from './music-visualizer.js';

const signal = { spectrum: new Uint8Array(512).fill(180), waveform: new Uint8Array(1024).fill(160), playing: true, sampleRate: 44100, fftSize: 1024 };
describe('visualizer motion', () => {
  it('has the same smoothing at 30 and 60 FPS', () => {
    const a = new VisualizerRenderer(), b = new VisualizerRenderer();
    const settings = parseVisualizerSettings({ smoothing: 90 });
    for (let i = 0; i < 30; i++) a.advance(signal, settings, 1 / 30);
    for (let i = 0; i < 60; i++) b.advance(signal, settings, 1 / 60);
    expect(a.energy).toBeCloseTo(b.energy, 5);
    expect(a.waveform[50]).toBeCloseTo(b.waveform[50], 5);
  });
  it('decays both waveform and spectrum on pause, then stops particle travel', () => {
    const renderer = new VisualizerRenderer(), settings = parseVisualizerSettings(null);
    for (let i = 0; i < 60; i++) renderer.advance(signal, settings, 1 / 60);
    for (let i = 0; i < 300; i++) renderer.advance(SILENT_ANALYSIS, settings, 1 / 60);
    expect(renderer.energy).toBeLessThan(.00001);
    expect(Math.abs(renderer.waveform[0])).toBeLessThan(.00001);
    const phase = renderer.phase;
    renderer.advance(SILENT_ANALYSIS, settings, 1 / 60);
    expect(renderer.phase - phase).toBeLessThan(.00001);
  });
  it('bounds malformed samples and handles absent metadata without NaN', () => {
    const renderer = new VisualizerRenderer();
    renderer.advance({ ...signal, sampleRate: NaN, fftSize: Infinity, spectrum: [NaN, Infinity, -5, 999], waveform: [NaN] }, parseVisualizerSettings(null), .1);
    expect([...renderer.bins, ...renderer.waveform, renderer.energy, renderer.phase].every(Number.isFinite)).toBe(true);
  });
  it('presets reset all parameters and legacy settings receive new defaults', () => {
    const settings = parseVisualizerSettings('{"mode":"wave","opacity":35}');
    expect(settings.opacity).toBe(35);
    expect(settings.glow).toBe(35);
    expect(visualizerPreset('silk').bass).toBe(100);
    expect(visualizerPreset('silk').colorMode).toBe('gradient');
  });

  it('keeps the old size and anchor when loading settings saved before placement controls', () => {
    const settings = parseVisualizerSettings('{"mode":"spectrum","position":"bottom","scale":120}');
    expect(visualizerPlacement(1000, 800, settings)).toEqual({ x: 500, y: 720, offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 });
    expect(settings.scale).toBe(120);
  });

  it('scales the two axes independently and moves in viewport percentages', () => {
    const settings = parseVisualizerSettings({ width: 50, height: 150, offsetX: -25, offsetY: -50 });
    expect(visualizerPlacement(1000, 800, settings)).toEqual({ x: 500, y: 720, offsetX: -250, offsetY: -400, scaleX: .5, scaleY: 1.5 });
    expect(visualizerPlacement(500, 400, settings).offsetX).toBe(-125);
    const bounded = parseVisualizerSettings({ width: 0, height: 1000, offsetX: Infinity, offsetY: -200 });
    expect([bounded.width, bounded.height, bounded.offsetX, bounded.offsetY]).toEqual([20, 200, 0, -100]);
  });

  it('renders every selectable mode with finite geometry at every anchor', () => {
    const calls: Array<{ name: string; args: number[] }> = [];
    const target: Record<string, unknown> = { globalAlpha: 1 };
    const g = new Proxy(target, {
      get: (object, key: string) => key in object ? object[key] : key === 'createLinearGradient'
        ? () => ({ addColorStop: () => {} })
        : (...args: number[]) => { calls.push({ name: key, args }); },
    }) as unknown as CanvasRenderingContext2D;
    expect(Object.keys(VISUALIZER_RENDERERS).sort()).toEqual(Object.keys(VISUALIZER_MODES).sort());
    for (const mode of Object.keys(VISUALIZER_MODES)) {
      for (const position of ['bottom', 'center', 'top', 'full']) {
        const settings = parseVisualizerSettings({ mode, position, width: 20, height: 200, offsetX: 100, offsetY: -100 });
        const renderer = new VisualizerRenderer();
        renderer.advance(signal, settings, .1);
        renderer.draw(g, 320, 180, settings, ['#123456', '#abcdef']);
      }
    }
    expect(calls.flatMap((call) => call.args).every(Number.isFinite)).toBe(true);
    expect(calls.filter((call) => call.name === 'arc').every((call) => call.args[2] >= 0)).toBe(true);
  });
});
