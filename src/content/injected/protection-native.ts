// Evaluation order matters: collect early statistics before installing any of the filters.
import './protection-stats-relay.js';
import './feed-ad-blocker.js';
import './tracker-blocker.js';
import './catalog-visibility-filter.js';
import './community-catalog-blocker.js';
import './music-catalog-blocker.js';
import { NATIVE_PROTECTION_MARKER } from '../../shared/constants/protection-startup.js';
import { PROTECTION_SCRIPTS } from '../core/injected-scripts.js';

const ping = (event: Event) => {
  const name = (event as CustomEvent).detail?.name;
  if (PROTECTION_SCRIPTS.includes(name)) window.dispatchEvent(new CustomEvent('vkify-script-ready', { detail: { name } }));
};
window.addEventListener('vkify:script:ping', ping);
document.documentElement?.setAttribute(NATIVE_PROTECTION_MARKER, '');
window.dispatchEvent(new Event('vkify:protection:ready'));
window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window || event.data?.type !== 'VKIFY_DESTROY') return;
  document.documentElement?.removeAttribute(NATIVE_PROTECTION_MARKER);
  window.removeEventListener('vkify:script:ping', ping);
});
