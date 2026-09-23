import { lyricsCoverPlacement } from '@/shared/music-lyrics.js';
import React, { useEffect, useRef } from 'react';
import { VISUALIZER_MODES, type VisualizerMode, type VisualizerSettings } from '@/shared/music-visualizer.js';
import { VisualizerRenderer, type VisualizerAnalysis } from '@/shared/visualizer-renderer.js';

/** Synthetic input is confined to the settings preview. No AudioContext or live media access. */
export default function VisualizerPreview({ settings, animated = true, thumbnail = false, className = '', onOffsetChange, onCoverOffsetChange }: {
  settings: VisualizerSettings; animated?: boolean; thumbnail?: boolean; className?: string;
  onOffsetChange?: (x: number, y: number) => void;
  onCoverOffsetChange?: (x: number, y: number) => void;
}): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef(settings);
  const redrawRef = useRef<(() => void) | null>(null);
  const dragRef = useRef<{ id: number; x: number; y: number; cover: boolean; offsetX: number; offsetY: number } | null>(null);
  settingsRef.current = settings;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new VisualizerRenderer();
    const cover = document.createElement('canvas'); cover.width = cover.height = 256;
    const coverContext = cover.getContext('2d');
    if (coverContext) {
      const gradient = coverContext.createLinearGradient(0, 0, 256, 256);
      gradient.addColorStop(0, '#2563eb'); gradient.addColorStop(1, '#db2777');
      coverContext.fillStyle = gradient; coverContext.fillRect(0, 0, 256, 256);
      coverContext.fillStyle = '#ffffff'; coverContext.font = 'bold 36px sans-serif'; coverContext.fillText('VKify', 28, 210);
      renderer.lyrics.cover = cover;
    }
    renderer.lyrics.reset(['Every beat brings us closer', 'Let the rhythm flow', 'Feel the music', 'We light up the night', 'A moment in sound', 'And the world keeps turning', 'Stay here for one more song'].map(text => ({ text })));
    const spectrum = new Uint8Array(512), waveform = new Uint8Array(1024);
    const analysis: VisualizerAnalysis = { spectrum, waveform, sampleRate: 48000, fftSize: 1024, playing: true };
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, last = 0, time = 7;
    const draw = (now: number): void => {
      if (document.hidden) return;
      if (animated && !reduced.matches && last && now - last < 32) { frame = requestAnimationFrame(draw); return; }
      const dt = last ? Math.min((now - last) / 1000, .1) : 1 / 30; last = now;
      time += dt;
      const width = canvas.clientWidth || 320, height = canvas.clientHeight || 180;
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); }
      for (let i = 0; i < spectrum.length; i++) {
        const shape = Math.exp(-i / 170) * (.45 + .3 * Math.sin(Math.log2(i + 1) * 3 + time * 3) + .2 * Math.cos(i * .07 - time * 2));
        spectrum[i] = Math.max(0, shape * (180 + 50 * Math.pow(Math.sin(time * 3), 8)));
      }
      for (let i = 0; i < waveform.length; i++) waveform[i] = 128 + Math.sin(i * .024 + time) * 45 * Math.sin(time * 1.3) + Math.cos(i * .045 + time * 2) * 20;
      analysis.playback = { currentTime: time % 20, duration: 20 };
      const current = settingsRef.current;
      const position = thumbnail ? VISUALIZER_MODES[current.mode as VisualizerMode].position : current.position;
      const preview = { ...current, ...(thumbnail ? { width: 100, height: 100, offsetX: 0, offsetY: 0 } : {}), position, quality: 'medium', blur: 0 };
      const g = canvas.getContext('2d');
      if (g) {
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, width, height);
        // Static thumbnails settle to an example signal without running an animation loop.
        for (let i = 0; i < (animated ? 1 : 20); i++) renderer.advance(analysis, preview, dt, reduced.matches);
        renderer.draw(g, width, height, preview, [current.color, current.colorMode === 'custom' ? current.color : current.color2], reduced.matches || !animated);
      }
      if (animated && !reduced.matches) frame = requestAnimationFrame(draw);
    };
    const restart = (): void => { cancelAnimationFrame(frame); last = 0; if (!document.hidden) frame = requestAnimationFrame(draw); };
    redrawRef.current = restart;
    const resize = new ResizeObserver(restart); resize.observe(canvas);
    document.addEventListener('visibilitychange', restart); reduced.addEventListener('change', restart);
    restart();
    return () => { redrawRef.current = null; cancelAnimationFrame(frame); resize.disconnect(); document.removeEventListener('visibilitychange', restart); reduced.removeEventListener('change', restart); };
  }, [animated, thumbnail]);
  useEffect(() => {
    if (!animated || matchMedia('(prefers-reduced-motion: reduce)').matches) redrawRef.current?.();
  }, [settings, animated]);
  const endDrag = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (dragRef.current?.id !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <canvas ref={canvasRef} aria-hidden="true" className={className}
    onPointerDown={(event) => {
      if ((!onOffsetChange && !onCoverOffsetChange) || event.button !== 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const placement = lyricsCoverPlacement(rect.width, rect.height, settings);
      const cover = !!onCoverOffsetChange && settings.lyricsShowCover && event.clientX - rect.left >= placement.x && event.clientX - rect.left <= placement.x + placement.size && event.clientY - rect.top >= placement.y && event.clientY - rect.top <= placement.y + placement.size;
      dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, cover, offsetX: cover ? settings.lyricsCoverX : settings.offsetX, offsetY: cover ? settings.lyricsCoverY : settings.offsetY };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    }}
    onPointerMove={(event) => {
      const drag = dragRef.current;
      if (!drag || drag.id !== event.pointerId) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const clamp = (value: number): number => Math.max(drag.cover ? 0 : -100, Math.min(100, Math.round(value)));
      const size = drag.cover ? lyricsCoverPlacement(rect.width, rect.height, settings).size : 0;
      const callback = drag.cover ? onCoverOffsetChange : onOffsetChange;
      callback?.(clamp(drag.offsetX + (event.clientX - drag.x) / Math.max(1, rect.width - size) * 100), clamp(drag.offsetY + (event.clientY - drag.y) / Math.max(1, rect.height - size) * 100));
    }}
    onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={() => { dragRef.current = null; }}
    style={{ touchAction: onOffsetChange || onCoverOffsetChange ? 'none' : undefined, filter: !thumbnail && settings.blur ? `blur(${settings.blur}px)` : undefined }} />;
}
