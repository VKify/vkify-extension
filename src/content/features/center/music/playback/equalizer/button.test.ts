// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { EQ_BTN_ATTR, injectEqualizerButton } from './button.js';

vi.mock('@/content/features/center/_shared/index.js', () => ({ attachBrandTooltip: vi.fn(), hideBrandTooltip: vi.fn() }));
afterEach(() => { document.body.replaceChildren(); });

it('injects into all VK player variants without duplicates and opens from each', () => {
  document.body.innerHTML = `
    <div data-testid="audioplayerplaybackbody-audiobutton"><div role="group"><button>Play</button></div></div>
    <div class="vkitAudioPlayerPlaybackBody__audioButtons--test" role="group"><button>Play</button></div>
    <div data-testid="audioplayerplaybackbody-audiobutton"><button>Play</button></div>`;
  const toggle = vi.fn();
  injectEqualizerButton(toggle); injectEqualizerButton(toggle);
  const buttons = document.querySelectorAll<HTMLButtonElement>(`[${EQ_BTN_ATTR}]`);
  expect(buttons).toHaveLength(3);
  buttons.forEach(button => button.click());
  expect(toggle).toHaveBeenCalledTimes(3);
});
