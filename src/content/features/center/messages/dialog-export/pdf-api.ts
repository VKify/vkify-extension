export interface PdfSaveOptions {
  shouldCancel?: () => boolean;
  onProgress?: (done: number, total: number) => void;
}

export const PDF_CLIENT_PORT_PREFIX = 'vkify-pdf-client:';
export const PDF_RENDERER_PORT_PREFIX = 'vkify-pdf-renderer:';

export type PdfClientMessage =
  | { type: 'init'; filename: string }
  | { type: 'chunk'; sequence: number; nodes: string[] }
  | { type: 'finish' }
  | { type: 'cancel' };

export type PdfRendererMessage =
  | { type: 'relay-ready' }
  | { type: 'ready' }
  | { type: 'chunk-ack'; sequence: number }
  | { type: 'progress'; done: number; total: number }
  | { type: 'done' }
  | { type: 'error'; error: string }
  | { type: 'peer-disconnected' };
