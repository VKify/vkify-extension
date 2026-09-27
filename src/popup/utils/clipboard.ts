/** Copy from both the extension popup and its cross-origin vk.ru iframe. */
function legacyCopy(text: string): boolean {
  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
  document.body.append(input);
  input.select();
  input.setSelectionRange(0, input.value.length);
  try { return document.execCommand('copy'); } catch { return false; }
  finally { input.remove(); }
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
