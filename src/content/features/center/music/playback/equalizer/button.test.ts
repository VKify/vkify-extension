// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { EQ_BTN_ATTR, injectEqualizerButton, removeEqualizerButton } from './button.js';

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

it('restores the control in current header and page players without injecting into track rows', () => {
  const group = '<div role="group"><button class="native-button" style="width:24px;height:24px"><svg class="vkuiIcon--music_note_wave_outline_24"></svg></button></div>';
  document.body.innerHTML = `<header>${group}</header><main>${group}<div data-audio-id="1_2">${group}</div></main>`;
  const toggle = vi.fn();
  injectEqualizerButton(toggle); injectEqualizerButton(toggle);
  expect(document.querySelectorAll(`[${EQ_BTN_ATTR}]`)).toHaveLength(2);
  expect(document.querySelector(`[data-audio-id] [${EQ_BTN_ATTR}]`)).toBeNull();
  const button = document.querySelector<HTMLButtonElement>(`header [${EQ_BTN_ATTR}]`)!;
  expect(button.className).toBe('native-button');
  expect(button.style.width).toBe('24px');
  button.click();
  expect(toggle).toHaveBeenCalledOnce();
  document.querySelector('header')!.innerHTML = group;
  injectEqualizerButton(toggle);
  expect(document.querySelectorAll(`[${EQ_BTN_ATTR}]`)).toHaveLength(2);
  removeEqualizerButton();
  expect(document.querySelectorAll(`[${EQ_BTN_ATTR}]`)).toHaveLength(0);
});
