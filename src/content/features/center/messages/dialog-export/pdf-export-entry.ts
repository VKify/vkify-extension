import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { PdfExporterApi } from './pdf-api.js';

const ROOT_WIDTH_PX = 718;
const MARGIN_MM = 8;
const ROOT_PADDING_PX = 56;
const MESSAGES_PER_CHUNK_LIMIT = 40;

interface LinkRect {
  href: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

function outerHeight(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.height
    + Number.parseFloat(style.marginTop || '0')
    + Number.parseFloat(style.marginBottom || '0');
}

async function waitForImages(root: ParentNode): Promise<void> {
  await Promise.all(Array.from(root.querySelectorAll('img')).map(image => {
    if (image.complete) return Promise.resolve();
    return new Promise<void>(resolve => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => resolve(), { once: true });
    });
  }));
}

function groupChildren(root: HTMLElement, availableHeight: number): HTMLElement[][] {
  const children = Array.from(root.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement && child.tagName !== 'STYLE');
  const groups: HTMLElement[][] = [];
  let group: HTMLElement[] = [];
  let height = 0;
  let messageCount = 0;

  for (let index = 0; index < children.length; index++) {
    const child = children[index];
    const pair = [child];
    let pairHeight = outerHeight(child);
    // Не оставляем разделитель дня одиноко внизу страницы.
    if (child.classList.contains('pdf-day') && children[index + 1]?.classList.contains('pdf-message')) {
      pair.push(children[++index]);
      pairHeight += outerHeight(pair[1]);
    }
    const pairMessages = pair.filter(node => node.classList.contains('pdf-message')).length;
    const pageFull = group.length > 0 && (
      height + pairHeight > availableHeight
      || messageCount + pairMessages > MESSAGES_PER_CHUNK_LIMIT
    );
    if (pageFull) {
      groups.push(group);
      group = [];
      height = 0;
      messageCount = 0;
    }
    group.push(...pair);
    height += pairHeight;
    messageCount += pairMessages;
  }
  if (group.length) groups.push(group);
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

function addCanvasToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  links: LinkRect[],
  firstPage: { value: boolean },
  rootWidth: number,
): void {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const innerWidth = pageWidth - MARGIN_MM * 2;
  const innerHeight = pageHeight - MARGIN_MM * 2;
  const maxSlicePx = Math.floor(canvas.width * innerHeight / innerWidth);
  const cssToMm = innerWidth / rootWidth;

  for (let topPx = 0; topPx < canvas.height; topPx += maxSlicePx) {
    const sliceHeight = Math.min(maxSlicePx, canvas.height - topPx);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sliceHeight;
    const context = slice.getContext('2d');
    if (!context) throw new Error('Could not create PDF canvas');
    context.drawImage(canvas, 0, topPx, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

    if (!firstPage.value) pdf.addPage();
    firstPage.value = false;
    const imageHeight = sliceHeight * innerWidth / canvas.width;
    pdf.addImage(slice.toDataURL('image/jpeg', 0.94), 'JPEG', MARGIN_MM, MARGIN_MM, innerWidth, imageHeight);

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
    slice.width = 0;
    slice.height = 0;
  }
}

const api: PdfExporterApi = {
  async save(element, filename) {
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
    const measuredRoot = element.cloneNode(true) as HTMLElement;
    host.appendChild(measuredRoot);
    document.body.appendChild(host);

    try {
      await waitForImages(measuredRoot);
      const groups = groupChildren(measuredRoot, availableHeightPx);
      const firstPage = { value: true };

      for (const group of groups) {
        const pageRoot = document.createElement('section');
        pageRoot.className = measuredRoot.className;
        for (const child of group) pageRoot.appendChild(child.cloneNode(true));
        host.appendChild(pageRoot);
        await waitForImages(pageRoot);

        const links = collectLinks(pageRoot);
        const rootWidth = pageRoot.getBoundingClientRect().width || ROOT_WIDTH_PX;
        const canvas = await html2canvas(pageRoot, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#eef1f5',
          logging: false,
          windowWidth: ROOT_WIDTH_PX,
        });
        addCanvasToPdf(pdf, canvas, links, firstPage, rootWidth);
        canvas.width = 0;
        canvas.height = 0;
        pageRoot.remove();
      }
      pdf.save(filename);
    } finally {
      host.remove();
    }
  },
};

window.__vkifyPdfExporter = api;
