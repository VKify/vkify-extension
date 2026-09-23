import { LyricsRenderer } from './lyrics-renderer.js';
import type { LyricPlayback } from './lyrics.js';
import { VISUALIZER_MODES, type VisualizerMode, type VisualizerSettings } from './music-visualizer.js';

export interface VisualizerAnalysis {
  playback?: LyricPlayback;
  spectrum: ArrayLike<number>;
  waveform: ArrayLike<number>;
  playing: boolean;
  sampleRate: number;
  fftSize: number;
}
export const SILENT_ANALYSIS: VisualizerAnalysis = { spectrum: [], waveform: [], playing: false, sampleRate: 48000, fftSize: 1024 };
const clamp = (value: number, min = 0, max = 1): number => Math.max(min, Math.min(max, value));
const byte = (value: number | undefined, fallback = 0): number => Number.isFinite(value) ? clamp(value!, 0, 255) : fallback;

export interface VisualizerFrame {
  bins: Float32Array;
  wave: Float32Array;
  energy: number;
  phase: number;
  count: number;
  width: number;
  height: number;
  x: number;
  y: number;
  amplitude: number;
  direction: number;
  settings: VisualizerSettings;
  colors: readonly [string, string];
  points: Float32Array;
  reaction: number;
}
type Renderer = (g: CanvasRenderingContext2D, f: VisualizerFrame) => void;

function stroke(g: CanvasRenderingContext2D, points: Float32Array, count: number): void {
  g.beginPath();
  g.moveTo(points[0], points[1]);
  for (let i = 1; i < count - 1; i++) {
    const j = i * 2;
    g.quadraticCurveTo(points[j], points[j + 1], (points[j] + points[j + 2]) / 2, (points[j + 1] + points[j + 3]) / 2);
  }
  g.lineTo(points[(count - 1) * 2], points[(count - 1) * 2 + 1]);
  g.stroke();
}

const spectrum: Renderer = (g, f) => {
  const left = f.width * .07, span = f.width * .86;
  for (let layer = 2; layer >= 0; layer--) {
    g.globalAlpha = f.settings.opacity / 100 * (layer === 0 ? .95 : .18);
    g.lineWidth = layer === 0 ? 2 : 1.3;
    const points = f.points;
    for (let i = 0; i < f.count; i++) {
      const t = i / (f.count - 1);
      const edge = Math.pow(Math.sin(t * Math.PI), .6);
      const v = f.bins[Math.round(Math.abs(t * 2 - 1) * 127)];
      const lift = v * f.amplitude * edge * (1 - layer * .2);
      points[i * 2] = left + span * t;
      points[i * 2 + 1] = f.y - f.direction * (lift + Math.sin(t * 12 + f.phase + layer) * f.energy * 8 * layer * f.reaction);
    }
    stroke(g, points, f.count);
  }
};

const bars: Renderer = (g, f) => {
  const count = Math.round(f.count * .55), span = f.width * .82, step = span / count;
  g.lineCap = 'round'; g.lineWidth = Math.max(2, Math.min(9, step * .46));
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const v = f.bins[Math.round(Math.abs(t * 2 - 1) * 127)];
    const size = Math.max(1, v * f.amplitude * Math.pow(Math.sin(t * Math.PI), .4));
    const x = f.width * .09 + (i + .5) * step;
    g.beginPath(); g.moveTo(x, f.y); g.lineTo(x, f.y - size * f.direction); g.stroke();
    g.globalAlpha = f.settings.opacity / 100 * .13;
    g.beginPath(); g.moveTo(x, f.y + f.direction * 7); g.lineTo(x, f.y + f.direction * (7 + size * .2)); g.stroke();
    g.globalAlpha = f.settings.opacity / 100;
  }
};

const wave: Renderer = (g, f) => {
  for (let layer = 0; layer < 3; layer++) {
    const points = f.points;
    for (let i = 0; i < f.count; i++) {
      const t = i / (f.count - 1), edge = Math.sin(t * Math.PI);
      const sample = f.wave[Math.round(t * 127)];
      const ribbon = Math.sin(t * Math.PI * (4 + layer) + f.phase * (1 + layer * .1)) * f.energy * .25;
      points[i * 2] = f.width * (.06 + .88 * t);
      points[i * 2 + 1] = f.y + (sample * .7 + ribbon) * f.amplitude * edge * (1 - layer * .18);
    }
    g.lineWidth = layer === 0 ? 2.4 : 1.2;
    g.globalAlpha = f.settings.opacity / 100 * (1 - layer * .3);
    stroke(g, points, f.count);
  }
};

const radial: Renderer = (g, f) => {
  const bound = Math.min(f.width / 2, f.y, f.height - f.y) - 12;
  const radius = Math.min(bound * .65, Math.min(f.width, f.height) * .18 * f.settings.scale / 100);
  for (let ring = 0; ring < 2; ring++) {
    g.beginPath();
    for (let i = 0; i <= f.count * 2; i++) {
      const angle = i / (f.count * 2) * Math.PI * 2;
      const v = f.bins[Math.round(Math.abs(Math.sin(angle * 2)) * 127)];
      const r = Math.min(bound, radius + v * Math.min(f.amplitude * .4, radius) + ring * 7);
      const x = f.x + Math.cos(angle + f.phase * .06) * r;
      const y = f.y + Math.sin(angle + f.phase * .06) * r;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath(); g.lineWidth = ring === 0 ? 2.2 : 1;
    g.globalAlpha = f.settings.opacity / 100 * (ring === 0 ? 1 : .3); g.stroke();
  }
};

const particles: Renderer = (g, f) => {
  // Stable seeds; displacement and travel are driven exclusively by audio energy.
  for (let i = 0; i < f.count * 2; i++) {
    const seed = ((i + 1) * .7548776662466927) % 1;
    const value = f.bins[i % 128] * f.reaction;
    const x = f.width * (.04 + .92 * ((seed + Math.sin(f.phase * .1 + i) * value * .04 + 1) % 1));
    const span = f.settings.position === 'full' ? f.height * .9 : Math.min(f.height * .45, f.amplitude * 1.5);
    const travel = (((i + 1) * .5698402909980532 + f.phase * .025 * (.4 + seed) * f.reaction) % 1);
    const y = f.settings.position === 'full' ? f.height * .95 - travel * span : f.y - f.direction * travel * span;
    g.globalAlpha = f.settings.opacity / 100 * (.08 + value * .8) * Math.sin(travel * Math.PI);
    g.beginPath(); g.arc(x, y, .7 + value * 3.5 * f.settings.scale / 100, 0, Math.PI * 2); g.fill();
  }
};

const aurora: Renderer = (g, f) => {
  const layers = f.settings.quality === 'low' ? 2 : 4;
  for (let layer = layers - 1; layer >= 0; layer--) {
    const points = f.points;
    for (let i = 0; i < f.count; i++) {
      const t = i / (f.count - 1), edge = Math.sin(t * Math.PI);
      const value = f.bins[Math.round(t * 127)];
      const curtain = Math.sin(t * 9 + f.phase * .4 + layer * .65) * f.energy;
      points[i * 2] = f.width * (.05 + .9 * t);
      points[i * 2 + 1] = f.y + (curtain + value * .25 * Math.sin(t * 20 + layer)) * f.amplitude * edge + (layer - layers / 2) * 5;
    }
    g.globalAlpha = f.settings.opacity / 100 * (.6 - layer * .09);
    g.lineWidth = 1.5;
    stroke(g, points, f.count);
    const thickness = 2 + f.energy * f.amplitude * .2;
    for (let i = f.count - 1; i >= 0; i--) g.lineTo(points[i * 2], points[i * 2 + 1] + thickness * Math.sin(i / (f.count - 1) * Math.PI));
    g.closePath(); g.globalAlpha *= .13; g.fill();
  }
};

const rings: Renderer = (g, f) => {
  const bound = Math.max(1, Math.min(f.width / 2, f.y, f.height - f.y) - 12);
  const radius = Math.min(bound * .7, Math.min(f.width, f.height) * .22 * f.settings.scale / 100);
  const count = f.settings.quality === 'low' ? 4 : 6;
  for (let ring = 0; ring < count; ring++) {
    const value = f.bins[ring * 12] * f.reaction;
    const pulse = (1 + Math.sin(f.phase + ring * .8)) * f.energy * f.reaction * radius * .06;
    const r = Math.min(bound, radius * (.3 + ring / count * .7) + value * radius * .18 + pulse);
    g.globalAlpha = f.settings.opacity / 100 * (.12 + value * .8) * (1 - ring / count * .45);
    g.lineWidth = 1 + value * 2;
    g.beginPath(); g.arc(f.x, f.y, r, 0, Math.PI * 2); g.stroke();
  }
};

const helix: Renderer = (g, f) => {
  const amplitude = (f.energy * .7 + .025) * f.amplitude;
  for (let side = 0; side < 2; side++) {
    const points = f.points;
    for (let i = 0; i < f.count; i++) {
      const t = i / (f.count - 1), edge = Math.sin(t * Math.PI);
      const angle = t * Math.PI * 6 + f.phase;
      const displacement = Math.sin(angle + side * Math.PI) * amplitude * edge;
      points[i * 2] = f.width * (.08 + .84 * t);
      points[i * 2 + 1] = f.y + displacement;
      if (side === 0 && i % 3 === 0) {
        g.globalAlpha = f.settings.opacity / 100 * (.08 + f.bins[Math.round(t * 127)] * .25);
        g.lineWidth = 1; g.beginPath(); g.moveTo(points[i * 2], f.y + displacement); g.lineTo(points[i * 2], f.y - displacement); g.stroke();
      }
    }
    g.globalAlpha = f.settings.opacity / 100 * (side === 0 ? .85 : .45);
    g.lineWidth = 2; stroke(g, points, f.count);
  }
};

const matrix: Renderer = (g, f) => {
  const columns = f.settings.quality === 'low' ? 20 : 32, rows = 12;
  const cellWidth = f.width * .82 / columns;
  const cellHeight = Math.min(f.height * .42, f.width * .32) * f.settings.scale / 100 / rows;
  for (let col = 0; col < columns; col++) {
    const value = f.bins[Math.round(Math.abs(col / (columns - 1) * 2 - 1) * 127)] * f.reaction;
    for (let row = 0; row < rows; row++) {
      const distance = Math.abs((row + .5) / rows * 2 - 1);
      const activation = clamp((value - distance) * 8);
      g.globalAlpha = f.settings.opacity / 100 * (.025 + activation * .8);
      g.fillRect(f.width * .09 + col * cellWidth, f.y + (row - rows / 2) * cellHeight, cellWidth * .62, cellHeight * .62);
    }
  }
};

/** Depth rings expand from a luminous vanishing point; frequency bins deform each edge. */
const portal: Renderer = (g, f) => {
  const radius = Math.max(1, Math.min(f.width, f.height) * .43 * f.settings.scale / 100);
  const layers = f.settings.quality === 'low' ? 8 : 16;
  const segments = f.settings.quality === 'low' ? 36 : 72;
  for (let layer = 0; layer < layers; layer++) {
    const depth = ((layer / layers + f.phase * .035) % 1 + 1) % 1;
    const r = radius * (.04 + depth * depth * .96);
    g.strokeStyle = f.colors[layer % 2];
    g.globalAlpha = f.settings.opacity / 100 * Math.sin(depth * Math.PI) * (.45 + f.energy * .5);
    g.lineWidth = .7 + depth * 2;
    g.beginPath();
    for (let i = 0; i <= segments; i++) {
      const angle = i / segments * Math.PI * 2;
      const twist = angle + depth * 2 + f.phase * .08;
      const frequency = f.bins[Math.round(Math.abs(Math.sin(angle * 2)) * 127)] * f.reaction;
      const ripple = 1 + Math.cos(angle * 6 + f.phase * .3) * frequency * .18;
      const x = f.x + Math.cos(twist) * r * ripple;
      const y = f.y + Math.sin(twist) * r * ripple;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath(); g.stroke();
  }
};

/** Project a rotating faceted crystal with translucent faces and reactive inner spines. */
const prism: Renderer = (g, f) => {
  const radius = Math.max(1, Math.min(f.width, f.height) * .34 * f.settings.scale / 100);
  const spin = f.phase * .16, tilt = .35 + Math.sin(f.phase * .09) * .15;
  const project = (x: number, y: number, z: number): [number, number] => {
    const rx = x * Math.cos(spin) - z * Math.sin(spin);
    const rz = x * Math.sin(spin) + z * Math.cos(spin);
    const ry = y * Math.cos(tilt) - rz * Math.sin(tilt);
    const depth = 2.8 / (2.8 + y * Math.sin(tilt) + rz * Math.cos(tilt));
    return [f.x + rx * radius * depth, f.y + ry * radius * depth];
  };
  const count = f.settings.quality === 'low' ? 6 : 10;
  const crown = 1.05 + f.energy * f.reaction * .3;
  const top = project(0, -crown, 0), bottom = project(0, crown, 0);
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2, b = (i + 1) / count * Math.PI * 2;
    const pulse = .7 + f.bins[Math.round(i / count * 90)] * f.reaction * .23;
    const p = project(Math.cos(a) * pulse, 0, Math.sin(a) * pulse);
    const q = project(Math.cos(b) * pulse, 0, Math.sin(b) * pulse);
    g.strokeStyle = f.colors[i % 2]; g.fillStyle = f.colors[(i + 1) % 2];
    for (const tip of [top, bottom]) {
      g.beginPath(); g.moveTo(...tip); g.lineTo(...p); g.lineTo(...q); g.closePath();
      g.globalAlpha = f.settings.opacity / 100 * (.03 + f.energy * .09); g.fill();
      g.globalAlpha = f.settings.opacity / 100 * (.25 + f.energy * .65); g.lineWidth = 1.2; g.stroke();
    }
  }
};

/** Layered organic contours breathe with the spectrum without random per-frame flicker. */
const nebula: Renderer = (g, f) => {
  const radius = Math.max(1, Math.min(f.width, f.height) * .34 * f.settings.scale / 100);
  const layers = f.settings.quality === 'low' ? 7 : 14;
  const segments = f.settings.quality === 'low' ? 40 : 80;
  for (let layer = layers - 1; layer >= 0; layer--) {
    const depth = layer / layers;
    g.strokeStyle = f.colors[layer % 2]; g.fillStyle = f.colors[layer % 2];
    g.beginPath();
    for (let i = 0; i <= segments; i++) {
      const a = i / segments * Math.PI * 2;
      const bin = f.bins[Math.round(Math.abs(Math.sin(a * 1.5)) * 127)] * f.reaction;
      const wave = Math.sin(a * 3 + f.phase * .4 + depth) * .12 + Math.cos(a * 5 - f.phase * .2) * .07;
      const r = radius * (.32 + depth * .65) * (1 + wave * (1 + bin) + bin * .25);
      const x = f.x + Math.cos(a) * r, y = f.y + Math.sin(a) * r;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath();
    g.globalAlpha = f.settings.opacity / 100 * .018; g.fill();
    g.globalAlpha = f.settings.opacity / 100 * (.12 + (1 - depth) * .42 + f.energy * .2);
    g.lineWidth = 1 + f.energy * f.reaction; g.stroke();
  }
};

export const VISUALIZER_RENDERERS: Record<VisualizerMode, Renderer> = { portal, prism, nebula, spectrum, bars, wave, radial, particles, aurora, rings, helix, matrix, lyrics: () => {} };

/** Percentages refer to the viewport. The identity defaults preserve old geometry exactly. */
export function visualizerPlacement(width: number, height: number, settings: VisualizerSettings) {
  const symmetric = VISUALIZER_MODES[settings.mode as VisualizerMode].symmetric;
  const y = settings.position === 'center' || settings.position === 'full' ? height * .5 : settings.position === 'top' ? height * (symmetric ? .22 : .07) : height * (symmetric ? .78 : .9);
  return { x: width / 2, y, offsetX: width * settings.offsetX / 100, offsetY: height * settings.offsetY / 100, scaleX: settings.width / 100, scaleY: settings.height / 100 };
}

/** Shared by the live overlay and its explicitly labelled demo; never owns a loop or DOM. */
export class VisualizerRenderer {
  readonly lyrics = new LyricsRenderer();
  readonly bins = new Float32Array(128);
  readonly waveform = new Float32Array(128);
  private readonly points = new Float32Array(192);
  energy = 0;
  phase = 0;

  advance(analysis: VisualizerAnalysis, settings: VisualizerSettings, dt: number, reduced = false): void {
    const seconds = clamp(dt, 0, .1);
    this.lyrics.advance(seconds);
    if (analysis.playback) this.lyrics.playback = analysis.playback;
    const response = 1 - Math.exp(-seconds / (.025 + settings.smoothing / 100 * .32));
    const release = 1 - Math.exp(-seconds / .28);
    const rate = Number.isFinite(analysis.sampleRate) && analysis.sampleRate >= 8000 ? analysis.sampleRate : 48000;
    const fft = Number.isFinite(analysis.fftSize) && analysis.fftSize >= 32 ? analysis.fftSize : 1024;
    let energy = 0;
    for (let i = 0; i < 128; i++) {
      const hz = 30 * Math.pow(16000 / 30, i / 127);
      const bin = hz * fft / rate, low = Math.floor(bin), blend = bin - low;
      const gain = (hz < 250 ? settings.bass : hz < 4000 ? settings.mids : settings.treble) / 100;
      const raw = (byte(analysis.spectrum[low]) * (1 - blend) + byte(analysis.spectrum[low + 1]) * blend) / 255;
      const target = analysis.playing ? clamp(raw * gain) : 0;
      this.bins[i] += (target - this.bins[i]) * (target > this.bins[i] ? response : release);
      const waveTarget = analysis.playing ? (byte(analysis.waveform[Math.floor(i / 128 * analysis.waveform.length)], 128) - 128) / 128 : 0;
      this.waveform[i] += (waveTarget - this.waveform[i]) * response;
      energy += this.bins[i];
    }
    this.energy = energy / 128;
    this.phase += seconds * settings.speed / 100 * this.energy * (reduced ? .5 : 3);
  }

  draw(g: CanvasRenderingContext2D, width: number, height: number, settings: VisualizerSettings, colors: readonly [string, string], reduced = false): void {
    if (settings.mode === 'lyrics') { this.lyrics.draw(g, width, height, settings, colors[0], this.energy, reduced); return; }
    g.save();
    const placement = visualizerPlacement(width, height, settings);
    g.translate(placement.x + placement.offsetX, placement.y + placement.offsetY);
    g.scale(placement.scaleX, placement.scaleY);
    g.translate(-placement.x, -placement.y);
    const gradient = g.createLinearGradient(width * .05, height * .2, width * .95, height * .8);
    gradient.addColorStop(0, colors[0]); gradient.addColorStop(.55, colors[1]); gradient.addColorStop(1, colors[0]);
    g.strokeStyle = gradient; g.fillStyle = gradient; g.lineJoin = 'round'; g.lineCap = 'round';
    g.globalAlpha = settings.opacity / 100;
    g.shadowColor = colors[0]; g.shadowBlur = settings.quality === 'low' ? 0 : settings.glow / 100 * 18;
    const y = placement.y;
    const reaction = settings.intensity / 100 * (reduced ? .3 : 1);
    const amplitude = Math.min(height * .42, width * .28) * reaction * settings.scale / 100;
    const count = settings.quality === 'low' ? 40 : settings.quality === 'high' ? 96 : 64;
    VISUALIZER_RENDERERS[settings.mode as VisualizerMode](g, { bins: this.bins, wave: this.waveform, energy: this.energy, phase: this.phase, count, width, height, x: width / 2, y, direction: settings.position === 'top' ? -1 : 1, amplitude, settings, colors, points: this.points, reaction });
    g.restore();
  }
}
