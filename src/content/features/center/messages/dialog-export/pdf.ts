import type { PdfExporterApi } from './pdf-api.js';
import { t } from '@/content/i18n/index.js';

let pending: Promise<PdfExporterApi> | null = null;

async function injectPdfExporter(): Promise<PdfExporterApi> {
  const response = await chrome.runtime.sendMessage({ type: 'INJECT_PDF_EXPORTER' }) as
    | { ok: boolean; error?: string }
    | undefined;
  if (!response?.ok) {
    throw new Error(t('messages.export.pdf.load_failed') + (response?.error ? `: ${response.error}` : ''));
  }

  const started = Date.now();
  for (;;) {
    if (window.__vkifyPdfExporter) return window.__vkifyPdfExporter;
    if (Date.now() - started > 5000) throw new Error(t('messages.export.pdf.load_failed'));
    await new Promise(resolve => setTimeout(resolve, 30));
  }
}

async function ensurePdfExporter(): Promise<PdfExporterApi> {
  if (window.__vkifyPdfExporter) return window.__vkifyPdfExporter;
  if (!pending) pending = injectPdfExporter();
  try {
    return await pending;
  } catch (error) {
    pending = null;
    throw error;
  }
}

export async function savePdf(element: HTMLElement, filename: string): Promise<void> {
  await (await ensurePdfExporter()).save(element, filename);
}
