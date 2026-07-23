export interface PdfSaveOptions {
  shouldCancel?: () => boolean;
  onProgress?: (done: number, total: number) => void;
}

export interface PdfExporterApi {
  save(element: HTMLElement, filename: string, options?: PdfSaveOptions): Promise<void>;
}

declare global {
  interface Window {
    __vkifyPdfExporter?: PdfExporterApi;
  }
}
