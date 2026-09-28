import type { ClockSettings } from './types.js';

/** Shared by the actual overlay and the settings preview. */
export function clockStyle(s: ClockSettings): Record<string, string> {
  return {
    color: s.color, background: s.showBackground ? `${s.background}${Math.round(s.backgroundOpacity * 2.55).toString(16).padStart(2, '0')}` : 'transparent',
    opacity: String(s.opacity / 100), fontSize: `${s.fontSize}px`, fontWeight: String(s.fontWeight),
    borderRadius: `${s.radius}px`, padding: '10px 16px', fontFamily: 'system-ui, sans-serif',
    fontVariantNumeric: 'tabular-nums', lineHeight: '1.3', boxSizing: 'border-box',
    border: s.glass && s.showBackground ? '1px solid #ffffff26' : '1px solid transparent',
    backdropFilter: s.glass && s.showBackground ? 'blur(12px)' : 'none',
    overflowWrap: 'anywhere', textAlign: 'center',
  };
}

export function clockPosition(s: ClockSettings, width: number, height: number, elementWidth: number, elementHeight: number) {
  const marginX = Math.min(s.margin, Math.max(0, (width - elementWidth) / 2));
  const marginY = Math.min(s.margin, Math.max(0, (height - elementHeight) / 2));
  const maxX = Math.max(marginX, width - elementWidth - marginX);
  const maxY = Math.max(marginY, height - elementHeight - marginY);
  const top = Math.min(maxY, Math.max(64, marginY));
  return {
    left: s.position === 'custom' ? marginX + (maxX - marginX) * s.x / 100 : s.position.endsWith('right') ? maxX : marginX,
    top: s.position === 'custom' ? marginY + (maxY - marginY) * s.y / 100 : s.position.startsWith('top') ? top : maxY,
  };
}
