import { useState, useEffect } from 'react';
import i18n from '@/popup/i18n.js';

const cache = new Map<string, ProjectJsonData>();

export interface PropertyDef {
  key: string;
  type: string;
  value: unknown;
  order?: number;
  [key: string]: unknown;
}

export interface ProjectJsonData {
  title: string;
  description: string;
  tags: string[];
  poster: string | null;
  src: string;
  rawProperties: Record<string, unknown>;
  properties: PropertyDef[];
  workshopId: string | null;
  rating: string | null;
}

export function weToCssColor(weColor: unknown): string {
  if (!weColor || typeof weColor !== 'string') return '#00ff00';
  const parts = weColor.trim().split(/\s+/).map(Number);
  if (parts.length < 3) return '#00ff00';
  const [r, g, b] = parts;
  const toHex = (v: number): string =>
    Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function cssToWeColor(cssHex: string): string {
  if (!cssHex || !cssHex.startsWith('#')) return '0 1 0';
  const r = parseInt(cssHex.slice(1, 3), 16) / 255;
  const g = parseInt(cssHex.slice(3, 5), 16) / 255;
  const b = parseInt(cssHex.slice(5, 7), 16) / 255;
  return `${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}`;
}

export function normalizeProperties(rawProperties: Record<string, unknown>): PropertyDef[] {
  if (!rawProperties || typeof rawProperties !== 'object') return [];
  return Object.entries(rawProperties)
    .map(([key, prop]) => ({ key, ...(prop as Record<string, unknown>) } as PropertyDef))
    .sort((a, b) => ((a.order ?? 999) as number) - ((b.order ?? 999) as number));
}

export function getDefaultValues(properties: PropertyDef[]): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const prop of properties) {
    if (prop.type === 'color') {
      defaults[prop.key] = weToCssColor(prop.value);
    } else {
      defaults[prop.key] = prop.value;
    }
  }
  return defaults;
}

export async function fetchProjectJson(folder: string): Promise<ProjectJsonData> {
  const url = `${folder}/project.json`;

  if (cache.has(url)) return cache.get(url)!;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json() as {
    title?: string;
    description?: string;
    tags?: string[];
    preview?: string;
    file?: string;
    general?: { properties?: Record<string, unknown> };
    workshopid?: string;
    contentrating?: string;
  };

  const data: ProjectJsonData = {
    title: json.title || i18n.t('appearance:background.untitled'),
    description: json.description || '',
    tags: json.tags || [],
    poster: json.preview ? `${folder}/${json.preview}` : null,
    src: json.file ? `${folder}/${json.file}` : `${folder}/index.html`,
    rawProperties: json.general?.properties || {},
    properties: normalizeProperties(json.general?.properties || {}),
    workshopId: json.workshopid || null,
    rating: json.contentrating || null,
  };

  cache.set(url, data);
  return data;
}

export function useProjectJson(folder: string | null | undefined): {
  data: ProjectJsonData | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<ProjectJsonData | null>(null);
  const [loading, setLoading] = useState(!!folder);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!folder) { setLoading(false); return; }
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchProjectJson(folder)
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((e: Error) => { if (!cancelled) { setError(e.message); setLoading(false); } });

    return () => { cancelled = true; };
  }, [folder]);

  return { data, loading, error };
}
