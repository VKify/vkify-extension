import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { PdfExporterApi, PdfSaveOptions } from './pdf-api.js';

const ROOT_WIDTH_PX = 718;
const MARGIN_MM = 8;
const ROOT_PADDING_PX = 56;
const MESSAGES_PER_PAGE_LIMIT = 40;
const MEASUREMENT_BATCH_SIZE = 24;
const IMAGE_WAIT_TIMEOUT_MS = 5_000;
const RENDER_SCALE = 1.5;

interface LinkRect {
  href: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface SourceUnit {
  nodes: HTMLElement[];
  messageCount: number;
}

interface MeasuredUnit extends SourceUnit {
  height: number;
}

function outerHeight(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.height
    + Number.parseFloat(style.marginTop || '0')
    + Number.parseFloat(style.marginBottom || '0');
}

function yieldToMainThread(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function throwIfCancelled(options?: PdfSaveOptions): void {
  if (options?.shouldCancel?.()) {
    throw new DOMException('PDF export cancelled', 'AbortError');
  }
}

async function waitForImages(
  root: ParentNode,
  timeoutMs = IMAGE_WAIT_TIMEOUT_MS,
): Promise<void> {
  const pending = Array.from(root.querySelectorAll('img')).filter(image => !image.complete);
  if (pending.length === 0) return;

  await new Promise<void>(resolve => {
    let remaining = pending.length;
    let settled = false;
    const listeners = new Map<HTMLImageElement, () => void>();

    const finish = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      for (const [image, listener] of listeners) {
        image.removeEventListener('load', listener);
        image.removeEventListener('error', listener);
      }
      resolve();
    };
    const timeout = setTimeout(finish, timeoutMs);

    for (const image of pending) {
      const listener = (): void => {
        if (!listeners.has(image)) return;
        listeners.delete(image);
        image.removeEventListener('load', listener);
        image.removeEventListener('error', listener);
        remaining--;
        if (remaining === 0) finish();
      };
      listeners.set(image, listener);
      image.addEventListener('load', listener, { once: true });
      image.addEventListener('error', listener, { once: true });
      if (image.complete) listener();
    }
  });
}

function collectSourceUnits(root: HTMLElement): SourceUnit[] {
  const children = Array.from(root.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement && child.tagName !== 'STYLE');
  const units: SourceUnit[] = [];

  for (let index = 0; index < children.length; index++) {
    const nodes = [children[index]];
    // Не оставляем разделитель дня одиноко внизу страницы.
    if (
      children[index].classList.contains('pdf-day')
      && children[index + 1]?.classList.contains('pdf-message')
    ) {
      nodes.push(children[++index]);
    }
    units.push({
      nodes,
      messageCount: nodes.filter(node => node.classList.contains('pdf-message')).length,
    });
  }
  return units;
}

async function measureUnits(
  host: HTMLElement,
  rootClassName: string,
  units: SourceUnit[],
  options?: PdfSaveOptions,
): Promise<MeasuredUnit[]> {
  const measured: MeasuredUnit[] = [];

  for (let offset = 0; offset < units.length; offset += MEASUREMENT_BATCH_SIZE) {
    throwIfCancelled(options);
    const batch = units.slice(offset, offset + MEASUREMENT_BATCH_SIZE);
    const measurementRoot = document.createElement('section');
    measurementRoot.className = rootClassName;
    const cloneGroups: HTMLElement[][] = [];

    for (const unit of batch) {
      const clones = unit.nodes.map(node => node.cloneNode(true) as HTMLElement);
      cloneGroups.push(clones);
      measurementRoot.append(...clones);
    }
    host.appendChild(measurementRoot);

    try {
      await waitForImages(measurementRoot);
      throwIfCancelled(options);
      // Сначала добавляем весь пакет, затем одним проходом читаем layout без перемежающихся DOM-записей.
      for (let index = 0; index < batch.length; index++) {
        measured.push({
          ...batch[index],
          height: cloneGroups[index].reduce((sum, node) => sum + outerHeight(node), 0),
        });
      }
    } finally {
      measurementRoot.remove();
    }
    await yieldToMainThread();
  }
  return measured;
}

function groupUnits(units: MeasuredUnit[], availableHeight: number): HTMLElement[][] {
  const groups: HTMLElement[][] = [];
  let group: HTMLElement[] = [];
  let height = 0;
  let messageCount = 0;

  for (const unit of units) {
    const pageFull = group.length > 0 && (
      height + unit.height > availableHeight
      || messageCount + unit.messageCount > MESSAGES_PER_PAGE_LIMIT
    );
    if (pageFull) {
      groups.push(group);
      group = [];
      height = 0;
      messageCount = 0;
    }
    group.push(...unit.nodes);
    height += unit.height;
    messageCount += unit.messageCount;
  }
  if (group.length > 0) groups.push(group);
  return groups;
}

function collectLinks(root: HTMLElement): LinkRect[] {
  const rootRect = root.getBoundingClientRect();
  return Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]')).flatMap(anchor => {
    const href = anchor.href;
    if (!/^(https?:|mailto:|tel:)/i.test(href)) return [];
    const rect = anchor.getBoundingClientRect();
    return [{
      href,
      left: rect.left - rootRect.left,
      top: rect.top - rootRect.top,
      width: rect.width,
      height: rect.height,
    }];
  });
}

async function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      result => result ? resolve(result) : reject(new Error('Could not encode PDF page')),
      'image/jpeg',
      0.9,
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}

async function addCanvasToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  links: LinkRect[],
  firstPage: { value: boolean },
  rootWidth: number,
  options?: PdfSaveOptions,
): Promise<void> {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const innerWidth = pageWidth - MARGIN_MM * 2;
  const innerHeight = pageHeight - MARGIN_MM * 2;
  const maxSlicePx = Math.floor(canvas.width * innerHeight / innerWidth);
  const cssToMm = innerWidth / rootWidth;

  for (let topPx = 0; topPx < canvas.height; topPx += maxSlicePx) {
    throwIfCancelled(options);
    const sliceHeight = Math.min(maxSlicePx, canvas.height - topPx);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sliceHeight;

    try {
      const context = slice.getContext('2d');
      if (!context) throw new Error('Could not create PDF canvas');
      context.drawImage(canvas, 0, topPx, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
      const jpeg = await canvasToJpeg(slice);
      throwIfCancelled(options);

      if (!firstPage.value) pdf.addPage();
      firstPage.value = false;
      const imageHeight = sliceHeight * innerWidth / canvas.width;
      pdf.addImage(jpeg, 'JPEG', MARGIN_MM, MARGIN_MM, innerWidth, imageHeight, undefined, 'FAST');

      const sliceTopCss = topPx * rootWidth / canvas.width;
      const sliceBottomCss = (topPx + sliceHeight) * rootWidth / canvas.width;
      for (const link of links) {
        const overlapTop = Math.max(link.top, sliceTopCss);
        const overlapBottom = Math.min(link.top + link.height, sliceBottomCss);
        if (overlapBottom <= overlapTop) continue;
        pdf.link(
          MARGIN_MM + link.left * cssToMm,
          MARGIN_MM + (overlapTop - sliceTopCss) * cssToMm,
          link.width * cssToMm,
          (overlapBottom - overlapTop) * cssToMm,
          { url: link.href },
        );
      }
    } finally {
      slice.width = 0;
      slice.height = 0;
    }
    await yieldToMainThread();
  }
}

const api: PdfExporterApi = {
  async save(element, filename, options) {
    throwIfCancelled(options);
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth() - MARGIN_MM * 2;
    const pageHeight = pdf.internal.pageSize.getHeight() - MARGIN_MM * 2;
    const availableHeightPx = ROOT_WIDTH_PX * pageHeight / pageWidth - ROOT_PADDING_PX;

    const host = document.createElement('div');
    Object.assign(host.style, {
      position: 'absolute',
      left: '-100000px',
      top: '0',
      width: `${ROOT_WIDTH_PX}px`,
      pointerEvents: 'none',
    });
    const style = element.querySelector(':scope > style')?.cloneNode(true);
    if (style) host.appendChild(style);
    document.body.appendChild(host);

    try {
      const units = collectSourceUnits(element);
      const measured = await measureUnits(host, element.className, units, options);
      const groups = groupUnits(measured, availableHeightPx);
      const firstPage = { value: true };
      options?.onProgress?.(0, groups.length);

      for (let index = 0; index < groups.length; index++) {
        throwIfCancelled(options);
        const pageRoot = document.createElement('section');
        pageRoot.className = element.className;
        for (const child of groups[index]) pageRoot.appendChild(child.cloneNode(true));
        host.appendChild(pageRoot);

        try {
          await waitForImages(pageRoot);
          throwIfCancelled(options);
          const links = collectLinks(pageRoot);
          const rootWidth = pageRoot.getBoundingClientRect().width || ROOT_WIDTH_PX;
          const canvas = await html2canvas(pageRoot, {
            scale: RENDER_SCALE,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#eef1f5',
            logging: false,
            imageTimeout: IMAGE_WAIT_TIMEOUT_MS,
            windowWidth: ROOT_WIDTH_PX,
          });

          try {
            throwIfCancelled(options);
            await addCanvasToPdf(pdf, canvas, links, firstPage, rootWidth, options);
          } finally {
            canvas.width = 0;
            canvas.height = 0;
          }
        } finally {
          pageRoot.remove();
        }
        options?.onProgress?.(index + 1, groups.length);
        await yieldToMainThread();
      }
      throwIfCancelled(options);
      pdf.save(filename);
    } finally {
      host.remove();
    }
  },
};

window.__vkifyPdfExporter = api;
