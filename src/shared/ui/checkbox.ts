import css from './checkbox.css?inline';
export const CHECKBOX_CLASS = 'vkify-checkbox';
export const CHECKBOX_CSS = css;
/** Native DOM adapter for content-script controls; shares the React component's CSS. */
export function createCheckbox(): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.className = CHECKBOX_CLASS;
  return input;
}
