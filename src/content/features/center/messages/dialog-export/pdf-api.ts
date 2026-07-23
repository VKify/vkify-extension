export interface PdfExporterApi {
  save(element: HTMLElement, filename: string): Promise<void>;
}

declare global {
  interface Window {
    __vkifyPdfExporter?: PdfExporterApi;
  }
}
