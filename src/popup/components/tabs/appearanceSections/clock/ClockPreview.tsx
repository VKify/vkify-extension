import React, { useEffect, useRef } from 'react';
import { createClockRenderer } from '@/shared/clock/renderer.js';
import type { ClockSettings } from '@/shared/clock/types.js';

export default function ClockPreview({ settings, locale, className = '' }: { settings: ClockSettings; locale: string; className?: string }): React.ReactElement {
  const element = useRef<HTMLDivElement>(null);
  const renderer = useRef<ReturnType<typeof createClockRenderer>>();
  useEffect(() => {
    if (!element.current) return;
    renderer.current = createClockRenderer(element.current);
    return () => { renderer.current?.dispose(); renderer.current = undefined; };
  }, []);
  useEffect(() => { renderer.current?.update(settings, locale); }, [settings, locale]);
  return <div ref={element} className={`max-w-full transition-all duration-200 ${className}`} />;
}
