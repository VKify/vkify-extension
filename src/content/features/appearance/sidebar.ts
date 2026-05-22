import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '../../../types/index.js';

export function createSidebarFeatures(manager: FeatureManager): FeatureMap {
  return {
    minimalistic_sidebar: {
      enable: () => initMinimalisticSidebar(manager),
      disable: () => destroyMinimalisticSidebar(manager),
    },
    sidebar_with_background: {
      enable: () => initSidebarBackground(manager),
      disable: () => destroySidebarBackground(manager),
    },
    fixed_sidebar: {
      enable: () => initFixedSidebar(manager),
      disable: () => destroyFixedSidebar(manager),
    },
  };
}


interface SidebarState {
  observer: MutationObserver | null;
  retryTimer: ReturnType<typeof setTimeout> | null;
  eventHandlers: Map<Element, { el: Element; enter: () => void; leave: () => void }>;
  destroyed: boolean;
}

let sidebarState: SidebarState | null = null;

const COMPACT_WIDTH = 52;
const CSS_KEY_SIDEBAR_BASE = 'minimalistic_sidebar_base';
const ATTR_COMPACT = 'data-compact-sidebar';
const ATTR_COMPACT_ITEM = 'data-compact-item';

function initMinimalisticSidebar(manager: FeatureManager) {
  if (sidebarState) destroyMinimalisticSidebar(manager);

  sidebarState = {
    observer: null,
    retryTimer: null,
    eventHandlers: new Map(),
    destroyed: false,
  };

  function findSidebar(): HTMLElement | null {
    const navs = document.querySelectorAll('nav');
    for (const nav of navs) {
      const ol = nav.querySelector('ol');
      if (!ol) continue;
      const items = ol.querySelectorAll(':scope > li');
      if (items.length < 3) continue;
      const hasMenuStructure = Array.from(items).some(li => {
        const link = li.querySelector('a[href]');
        const icon = li.querySelector('svg');
        return link && icon;
      });
      if (hasMenuStructure) {
        let sidebar: HTMLElement | null = nav.parentElement as HTMLElement;
        while (sidebar && sidebar !== document.body) {
          const rect = sidebar.getBoundingClientRect();
          if (rect.left < 100 && rect.width < 300 && rect.height > 200) return sidebar;
          sidebar = sidebar.parentElement as HTMLElement;
        }
        return nav.parentElement as HTMLElement;
      }
    }
    return null;
  }

  interface MenuItem {
    li: Element;
    link: Element;
    icon: Element;
    label: Element | null;
    labelText: string;
    counter: Element | null;
    settingsBtn: Element | null;
  }

  function analyzeMenuItem(li: Element): MenuItem | null {
    const link = li.querySelector('a[href]');
    if (!link) return null;
    const icon = link.querySelector('svg');
    if (!icon) return null;

    let label: Element | null = null;
    let labelText = '';
    let counter: Element | null = null;

    const spans = link.querySelectorAll('span');
    for (const span of spans) {
      const text = span.textContent?.trim();
      if (!text || text.length === 0) continue;
      if (!label && text.length < 30 && !span.querySelector('svg') && !/^\d+$/.test(text)) {
        label = span;
        labelText = text;
      } else if (!counter && /^\d+$/.test(text)) {
        counter = span;
      }
      if (label && counter) break;
    }

    let settingsBtn: Element | null = null;
    const buttons = li.querySelectorAll('[role="button"]');
    for (const btn of buttons) {
      if (!link.contains(btn) && btn.querySelector('svg')) {
        settingsBtn = btn;
        break;
      }
    }

    return { li, link, icon, label, labelText, counter, settingsBtn };
  }

  function markIconWrapper(link: Element) {
    const divs = link.querySelectorAll('div');
    for (const div of divs) {
      if (!div.querySelector('svg')) continue;
      const attrStyle = div.getAttribute('style');
      if (attrStyle && attrStyle.includes('width') && attrStyle.includes('height')) {
        div.setAttribute('data-compact-icon-wrap', '');
        return;
      }
    }
    const svg = link.querySelector('svg');
    if (svg) {
      let parent = svg.parentElement;
      while (parent && parent !== link) {
        if (parent.tagName === 'DIV') {
          parent.setAttribute('data-compact-icon-wrap', '');
          return;
        }
        parent = parent.parentElement;
      }
    }
  }

  function createTooltip(menuItem: MenuItem): HTMLElement {
    const tooltip = document.createElement('div');
    tooltip.textContent = menuItem.labelText;
    tooltip.setAttribute('data-sidebar-tooltip', 'true');

    const arrowOuter = document.createElement('div');
    arrowOuter.className = 'sidebar-tooltip-arrow-outer';
    tooltip.appendChild(arrowOuter);

    const arrowInner = document.createElement('div');
    arrowInner.className = 'sidebar-tooltip-arrow-inner';
    tooltip.appendChild(arrowInner);

    return tooltip;
  }

  function removeExistingTooltips(container: Element) {
    container.querySelectorAll('[data-sidebar-tooltip]').forEach(t => t.remove());
    if (sidebarState?.eventHandlers) {
      sidebarState.eventHandlers.forEach(({ el, enter, leave }) => {
        el.removeEventListener('mouseenter', enter);
        el.removeEventListener('mouseleave', leave);
      });
      sidebarState.eventHandlers.clear();
    }
  }

  function applyMarkers() {
    if (!sidebarState || sidebarState.destroyed) return;

    const sidebar = findSidebar();
    if (!sidebar) {
      if (sidebarState && !sidebarState.destroyed) {
        if (sidebarState.retryTimer) clearTimeout(sidebarState.retryTimer);
        sidebarState.retryTimer = setTimeout(applyMarkers, 500);
      }
      return;
    }

    sidebar.setAttribute(ATTR_COMPACT, '');

    const nav = sidebar.querySelector('nav');
    if (nav) {
      nav.setAttribute(ATTR_COMPACT, '');
      const menuRoot = nav.parentElement;
      if (menuRoot) menuRoot.setAttribute(ATTR_COMPACT, 'root');
    }

    const mainOl = nav?.querySelector('ol');
    if (mainOl) mainOl.setAttribute(ATTR_COMPACT, 'ol');

    removeExistingTooltips(sidebar);

    const items = mainOl?.querySelectorAll(':scope > li') ?? [];
    items.forEach(li => {
      const menuItem = analyzeMenuItem(li);
      if (!menuItem) return;

      li.setAttribute(ATTR_COMPACT_ITEM, '');
      menuItem.link.setAttribute(ATTR_COMPACT_ITEM, 'link');
      markIconWrapper(menuItem.link);

      if (menuItem.label) menuItem.label.setAttribute(ATTR_COMPACT_ITEM, 'label');
      if (menuItem.settingsBtn) menuItem.settingsBtn.setAttribute(ATTR_COMPACT_ITEM, 'settings');
      if (menuItem.counter) menuItem.counter.setAttribute(ATTR_COMPACT_ITEM, 'counter');

      if (menuItem.labelText && !li.querySelector('[data-sidebar-tooltip]')) {
        const tooltip = createTooltip(menuItem);
        menuItem.link.appendChild(tooltip);

        const onEnter = () => { tooltip.style.opacity = '1'; tooltip.style.visibility = 'visible'; };
        const onLeave = () => { tooltip.style.opacity = '0'; tooltip.style.visibility = 'hidden'; };

        li.addEventListener('mouseenter', onEnter);
        li.addEventListener('mouseleave', onLeave);
        sidebarState!.eventHandlers.set(li, { el: li, enter: onEnter, leave: onLeave });
      }
    });

    if (mainOl) {
      Array.from(mainOl.children).forEach(child => {
        if (child.tagName !== 'LI' && (child.querySelector('hr') || child.tagName === 'HR')) {
          child.setAttribute(ATTR_COMPACT_ITEM, 'separator');
        }
      });
    }

    const mainOlRef = sidebar.querySelector('nav ol');
    sidebar.querySelectorAll('ol').forEach(ol => {
      if (ol !== mainOlRef && !mainOlRef?.contains(ol)) {
        ol.setAttribute(ATTR_COMPACT_ITEM, 'footer');
      }
    });

    const adsWrapper = sidebar.querySelector('#ads_wrapper') ?? sidebar.querySelector('[id*="ads"]');
    if (adsWrapper) adsWrapper.setAttribute(ATTR_COMPACT_ITEM, 'footer');

    sidebar.querySelectorAll('div').forEach(div => {
      if (div.querySelector('hr') && !mainOlRef?.contains(div) && !div.closest('nav')) {
        div.setAttribute(ATTR_COMPACT_ITEM, 'footer');
      }
    });

    sidebar.querySelectorAll('span[class*="Badge"]').forEach(badge => {
      if (badge.closest('a')) badge.setAttribute(ATTR_COMPACT_ITEM, 'badge');
    });
  }

  function setupObserver() {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    sidebarState!.observer = new MutationObserver((mutations) => {
      if (!sidebarState || sidebarState.destroyed) return;
      let needsReprocess = false;
      for (const m of mutations) {
        if (needsReprocess) break;
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          const el = node as Element;
          const tag = el.tagName;
          if (tag === 'LI' || tag === 'NAV' || tag === 'OL' ||
            el.querySelector?.('nav') || el.querySelector?.('li')) {
            needsReprocess = true;
            break;
          }
        }
      }
      if (needsReprocess) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (!sidebarState || sidebarState.destroyed) return;
          applyMarkers();
        }, 100);
      }
    });
    sidebarState!.observer.observe(document.body, { childList: true, subtree: true });
  }

  manager.injectCSS(CSS_KEY_SIDEBAR_BASE, `
    #layout_sidebar,
    [data-testid="leftmenu"],
    [data-testid="leftmenu"] ol {
      overflow: visible !important;
    }
    div#layout_sidebar {
      width: ${COMPACT_WIDTH}px !important;
      z-index: 11;
    }
    .ScrollStickyWrapper {
      flex-grow: 0 !important;
    }
    nav[${ATTR_COMPACT}] {
      width: ${COMPACT_WIDTH}px !important;
      overflow: visible !important;
    }
    [${ATTR_COMPACT}="root"] {
      width: auto !important;
      overflow: visible !important;
    }
    [${ATTR_COMPACT}="ol"] {
      padding: 8px 0 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      gap: 2px !important;
    }
    [${ATTR_COMPACT_ITEM}] {
      position: relative !important;
      overflow: visible !important;
    }
    [${ATTR_COMPACT_ITEM}="link"] {
      width: 36px !important;
      height: 36px !important;
      padding: 8px !important;
      margin: 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      border-radius: 10px !important;
      box-sizing: border-box !important;
      overflow: visible !important;
      position: relative !important;
    }
    [data-compact-icon-wrap] {
      margin: 0 !important;
      position: relative !important;
      top: 1px !important;
    }
    [${ATTR_COMPACT_ITEM}="label"],
    [${ATTR_COMPACT_ITEM}="settings"],
    [${ATTR_COMPACT_ITEM}="separator"],
    [${ATTR_COMPACT_ITEM}="footer"],
    [${ATTR_COMPACT_ITEM}="badge"] {
      display: none !important;
    }
    [${ATTR_COMPACT_ITEM}="counter"] {
      position: absolute !important;
      top: 0px !important;
      right: 0px !important;
      min-width: 16px !important;
      padding: 0 4px !important;
      background-color: var(--vkui--color_accent_red, #ff3347) !important;
      color: #fff !important;
      font-size: 10px !important;
      font-weight: 700 !important;
      text-align: center !important;
      border: 2px solid var(--vkui--color_background_content, #fff) !important;
      border-radius: 10px !important;
      box-sizing: border-box !important;
      z-index: 1 !important;
      pointer-events: none !important;
      display: inline-block !important;
    }
    [data-sidebar-tooltip] {
      position: absolute;
      left: calc(100% + 8px);
      top: 50%;
      transform: translateY(-50%);
      z-index: 10000;
      padding: 6px 12px;
      background-color: var(--vkui--color_background_modal, #fff);
      color: var(--vkui--color_text_primary, #000);
      border-radius: 8px;
      border: 1px solid var(--vkui--color_separator_primary, #dce1e6);
      white-space: nowrap;
      font-size: 13px;
      font-weight: 500;
      line-height: 1.4;
      opacity: 0;
      visibility: hidden;
      pointer-events: none !important;
      transition: opacity 0.15s ease, visibility 0.15s ease;
    }
    .sidebar-tooltip-arrow-outer {
      position: absolute;
      top: 50%; left: -6px;
      transform: translateY(-50%);
      width: 0; height: 0;
      border-style: solid;
      border-width: 6px 6px 6px 0;
      border-color: transparent var(--vkui--color_separator_primary, #dce1e6) transparent transparent;
    }
    .sidebar-tooltip-arrow-inner {
      position: absolute;
      top: 50%; left: -5px;
      transform: translateY(-50%);
      width: 0; height: 0;
      border-style: solid;
      border-width: 5px 5px 5px 0;
      border-color: transparent var(--vkui--color_background_modal, #fff) transparent transparent;
    }
  `);

  applyMarkers();
  setupObserver();

  sidebarState.retryTimer = setTimeout(() => {
    if (sidebarState && !sidebarState.destroyed) applyMarkers();
  }, 500);
}

function destroyMinimalisticSidebar(manager: FeatureManager) {
  if (!sidebarState) return;
  sidebarState.destroyed = true;

  if (sidebarState.observer) { sidebarState.observer.disconnect(); sidebarState.observer = null; }
  if (sidebarState.retryTimer) { clearTimeout(sidebarState.retryTimer); sidebarState.retryTimer = null; }

  manager.removeCSS(CSS_KEY_SIDEBAR_BASE);

  if (sidebarState.eventHandlers) {
    sidebarState.eventHandlers.forEach(({ el, enter, leave }) => {
      el.removeEventListener('mouseenter', enter);
      el.removeEventListener('mouseleave', leave);
    });
    sidebarState.eventHandlers.clear();
  }

  document.querySelectorAll('[data-sidebar-tooltip]').forEach(t => t.remove());
  document.querySelectorAll(`[${ATTR_COMPACT}]`).forEach(el => el.removeAttribute(ATTR_COMPACT));
  document.querySelectorAll(`[${ATTR_COMPACT_ITEM}]`).forEach(el => el.removeAttribute(ATTR_COMPACT_ITEM));
  document.querySelectorAll('[data-compact-icon-wrap]').forEach(el => el.removeAttribute('data-compact-icon-wrap'));

  sidebarState = null;
}


interface BgState {
  observer: MutationObserver | null;
  retryTimer: ReturnType<typeof setTimeout> | null;
  destroyed: boolean;
}

let bgState: BgState | null = null;

const CSS_KEY_SIDEBAR_BG = 'sidebar_with_background_css';
const CLS_BG_CONTAINER = 'vke-sidebar-bg';
const CLS_BG_LINK = 'vke-sidebar-bg-link';
const CLS_BG_ROOT = 'vke-sidebar-bg-root';

function initSidebarBackground(manager: FeatureManager) {
  if (bgState) destroySidebarBackground(manager);

  bgState = { observer: null, retryTimer: null, destroyed: false };

  function findSidebarContainer(): HTMLElement | null {
    const layoutSidebar = document.querySelector<HTMLElement>('#layout_sidebar');
    if (layoutSidebar) return layoutSidebar;

    const sideBarInner = document.querySelector<HTMLElement>('#side_bar_inner, .side_bar_inner');
    if (sideBarInner) return sideBarInner;

    const navs = document.querySelectorAll('nav');
    for (const nav of navs) {
      const ol = nav.querySelector('ol');
      if (ol && ol.querySelectorAll(':scope > li').length >= 3) {
        return nav.closest<HTMLElement>('[id*="sidebar"], [id*="side_bar"]') ?? nav.parentElement as HTMLElement;
      }
    }
    return null;
  }

  function applyClasses() {
    if (!bgState || bgState.destroyed) return;

    const container = findSidebarContainer();
    if (!container) {
      if (bgState && !bgState.destroyed) {
        if (bgState.retryTimer) clearTimeout(bgState.retryTimer);
        bgState.retryTimer = setTimeout(applyClasses, 500);
      }
      return;
    }

    container.classList.add(CLS_BG_CONTAINER);

    container.querySelectorAll('a').forEach(link => {
      const li = link.closest('li');
      if (li && link.querySelector('svg')) {
        link.classList.add(CLS_BG_LINK);
      }
    });

    const nav = container.querySelector('nav');
    if (nav) {
      const menuRoot = nav.parentElement;
      if (menuRoot && menuRoot !== container) {
        menuRoot.classList.add(CLS_BG_ROOT);
      }
    }
  }

  manager.injectCSS(CSS_KEY_SIDEBAR_BG, `
    .${CLS_BG_CONTAINER} {
      box-shadow: var(--page-block-shadow) !important;
      background: var(--vkui--color_background_content) !important;
      border-radius: var(--vkui--size_border_radius_paper--regular) !important;
      padding: 4px !important;
      margin-top: 16px !important;
      transform: translateY(0%) translateX(-10px) !important;
    }
    .${CLS_BG_LINK} {
      border-radius: 10px !important;
    }
    .${CLS_BG_ROOT} {
      margin: 0 !important;
      padding: 0 !important;
    }
  `);

  applyClasses();

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  bgState.observer = new MutationObserver(() => {
    if (!bgState || bgState.destroyed) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (!bgState || bgState.destroyed) return;
      applyClasses();
    }, 200);
  });

  bgState.observer.observe(document.body, { childList: true, subtree: true });
}

function destroySidebarBackground(manager: FeatureManager) {
  if (!bgState) return;
  bgState.destroyed = true;

  if (bgState.observer) { bgState.observer.disconnect(); bgState.observer = null; }
  if (bgState.retryTimer) { clearTimeout(bgState.retryTimer); bgState.retryTimer = null; }

  manager.removeCSS(CSS_KEY_SIDEBAR_BG);

  document.querySelectorAll(`.${CLS_BG_CONTAINER}`).forEach(el => el.classList.remove(CLS_BG_CONTAINER));
  document.querySelectorAll(`.${CLS_BG_LINK}`).forEach(el => el.classList.remove(CLS_BG_LINK));
  document.querySelectorAll(`.${CLS_BG_ROOT}`).forEach(el => el.classList.remove(CLS_BG_ROOT));

  bgState = null;
}


interface FixedState {
  observer: MutationObserver | null;
  retryTimer: ReturnType<typeof setTimeout> | null;
  destroyed: boolean;
}

let fixedState: FixedState | null = null;

const CSS_KEY_SIDEBAR_FIXED = 'fixed_sidebar_css';
const CLS_FIXED = 'vke-sidebar-fixed';

function initFixedSidebar(manager: FeatureManager) {
  if (fixedState) destroyFixedSidebar(manager);

  fixedState = { observer: null, retryTimer: null, destroyed: false };

  function getHeaderHeight(): number {
    const selectors = ['header', '[class*="TopNav"]', '[class*="top_nav"]', '#top_nav', '.top_nav'];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.height > 0 && rect.height < 100) return rect.height;
      }
    }
    for (const el of document.body.children) {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (
        (style.position === 'fixed' || style.position === 'sticky') &&
        rect.top < 10 && rect.height > 30 && rect.height < 100 &&
        rect.width > window.innerWidth * 0.5
      ) {
        return rect.height;
      }
    }
    return 48;
  }

  function findSidebarContainer(): HTMLElement | null {
    const layoutSidebar = document.querySelector<HTMLElement>('#layout_sidebar');
    if (layoutSidebar) return layoutSidebar;

    const sideBar = document.querySelector<HTMLElement>('#side_bar');
    if (sideBar) return sideBar;

    const navs = document.querySelectorAll('nav');
    for (const nav of navs) {
      const ol = nav.querySelector('ol');
      if (ol && ol.querySelectorAll(':scope > li').length >= 3) {
        return nav.closest<HTMLElement>('[id*="sidebar"], [id*="side_bar"]') ?? nav.parentElement as HTMLElement;
      }
    }
    return null;
  }

  function applyClass() {
    if (!fixedState || fixedState.destroyed) return;

    const container = findSidebarContainer();
    if (!container) {
      if (fixedState && !fixedState.destroyed) {
        if (fixedState.retryTimer) clearTimeout(fixedState.retryTimer);
        fixedState.retryTimer = setTimeout(applyClass, 500);
      }
      return;
    }

    const headerHeight = getHeaderHeight();
    const topOffset = headerHeight + 15;

    container.classList.add(CLS_FIXED);
    container.style.setProperty('--vke-fixed-top', topOffset + 'px');
    container.style.setProperty('--vke-fixed-max-h', `calc(100vh - ${topOffset + 15}px)`);
  }

  manager.injectCSS(CSS_KEY_SIDEBAR_FIXED, `
    .${CLS_FIXED} {
      position: sticky !important;
      top: var(--vke-fixed-top, 63px) !important;
      align-self: flex-start !important;
      height: auto !important;
      max-height: var(--vke-fixed-max-h, calc(100vh - 78px)) !important;
      overflow-y: auto !important;
      overflow-x: visible !important;
    }
  `);

  applyClass();

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  fixedState.observer = new MutationObserver(() => {
    if (!fixedState || fixedState.destroyed) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (!fixedState || fixedState.destroyed) return;
      applyClass();
    }, 200);
  });

  fixedState.observer.observe(document.body, { childList: true, subtree: true });
}

function destroyFixedSidebar(manager: FeatureManager) {
  if (!fixedState) return;
  fixedState.destroyed = true;

  if (fixedState.observer) { fixedState.observer.disconnect(); fixedState.observer = null; }
  if (fixedState.retryTimer) { clearTimeout(fixedState.retryTimer); fixedState.retryTimer = null; }

  manager.removeCSS(CSS_KEY_SIDEBAR_FIXED);

  document.querySelectorAll(`.${CLS_FIXED}`).forEach(el => {
    (el as HTMLElement).classList.remove(CLS_FIXED);
    (el as HTMLElement).style.removeProperty('--vke-fixed-top');
    (el as HTMLElement).style.removeProperty('--vke-fixed-max-h');
  });

  fixedState = null;
}