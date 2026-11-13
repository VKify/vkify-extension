/** Buffer results produced before the isolated-world statistics collector is listening. */
const queued: unknown[] = [];
let ready = false;
const blocked = (event: Event) => {
  if (!ready) queued.push((event as CustomEvent).detail);
};
const connected = () => {
  ready = true;
  for (const detail of queued.splice(0)) window.dispatchEvent(new CustomEvent('vkify:blocked', { detail }));
};
const disconnected = () => { ready = false; };
window.addEventListener('vkify:blocked', blocked);
window.addEventListener('vkify:stats:ready', connected);
window.addEventListener('vkify:stats:disconnected', disconnected);
window.dispatchEvent(new Event('vkify:stats:ping'));
const destroy = (event: MessageEvent) => {
  if (event.source !== window || event.data?.type !== 'VKIFY_DESTROY') return;
  queued.length = 0;
  window.removeEventListener('vkify:blocked', blocked);
  window.removeEventListener('vkify:stats:ready', connected);
  window.removeEventListener('vkify:stats:disconnected', disconnected);
  window.removeEventListener('message', destroy);
};
window.addEventListener('message', destroy);
