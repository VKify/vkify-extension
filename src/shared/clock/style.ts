import type { ClockSettings } from './types.js';

const fonts: Record<ClockSettings['fontFamily'], string> = {
  system: 'system-ui, sans-serif',
  mono: 'ui-monospace, "Cascadia Code", Consolas, monospace',
  serif: 'Georgia, "Times New Roman", serif',
  rounded: '"Arial Rounded MT Bold", "Trebuchet MS", sans-serif',
};

/** Shared by the actual overlay and the settings preview. */
export function clockStyle(s: ClockSettings): Record<string, string> {
  const alpha = Math.round(s.backgroundOpacity * 255 / 100).toString(16).padStart(2, '0');
  const background = s.gradient
    ? `linear-gradient(${s.gradientAngle}deg, ${s.background}${alpha}, ${s.backgroundSecondary}${alpha})`
    : `${s.background}${alpha}`;
  return {
    color: s.color, background: s.showBackground ? background : 'transparent',
    opacity: String(s.opacity / 100), fontSize: `${s.fontSize}px`, fontWeight: String(s.fontWeight),
    borderRadius: `${s.radius}px`, padding: `${s.padding}px ${s.padding ? s.padding + 6 : 0}px`, fontFamily: fonts[s.fontFamily],
    letterSpacing: `${s.letterSpacing}px`,
    fontVariantNumeric: 'tabular-nums', lineHeight: '1.3', boxSizing: 'border-box',
    border: s.borderWidth > 0 ? `${s.borderWidth}px solid ${s.borderColor}` : s.glass && s.showBackground ? '1px solid #ffffff26' : '1px solid transparent',
    backdropFilter: s.glass && s.showBackground ? `blur(${s.blur}px)` : 'none',
    boxShadow: s.shadow > 0 ? `0 ${Math.round(s.shadow / 3)}px ${s.shadow}px #00000040` : 'none',
    textShadow: s.glow > 0 ? `0 0 ${s.glow}px ${s.color}, 0 0 ${s.glow * 2}px ${s.color}80` : 'none',
    overflowWrap: 'anywhere', textAlign: 'center',
  };
}

export function clockPosition(s: ClockSettings, width: number, height: number, elementWidth: number, elementHeight: number) {
  const availableX = Math.max(0, width - elementWidth);
  const availableY = Math.max(0, height - elementHeight);
  const marginX = Math.min(s.margin, availableX / 2);
  const marginY = Math.min(s.margin, availableY / 2);
  const maxX = availableX - marginX;
  const maxY = availableY - marginY;
  const top = Math.min(maxY, Math.max(64, marginY));
  return {
    left: s.position === 'custom' ? marginX + (maxX - marginX) * s.x / 100 : s.position.endsWith('right') ? maxX : marginX,
    top: s.position === 'custom' ? marginY + (maxY - marginY) * s.y / 100 : s.position.startsWith('top') ? top : maxY,
  };
}
