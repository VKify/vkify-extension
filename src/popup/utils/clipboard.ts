/** Copy from both the extension popup and its cross-origin vk.ru iframe. */
function legacyCopy(text: string): boolean {
  const focused = document.activeElement;
  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  document.body.append(input);
  try {
    input.focus({ preventScroll: true });
    input.select();
    input.setSelectionRange(0, input.value.length);
    return document.execCommand('copy');
  } catch { return false; }
  finally {
    input.remove();
    if (focused instanceof HTMLElement && focused.isConnected) focused.focus({ preventScroll: true });
  }
}

export async function copyText(text: string): Promise<void> {
  // execCommand retains the click's user activation inside an embedded popup;
  // navigator.clipboard may be rejected there by the browser permission policy.
  if (window.self !== window.top && legacyCopy(text)) return;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
    await navigator.clipboard.writeText(text);
  } catch (error) {
    if (legacyCopy(text)) return;
    throw error;
  }
}
