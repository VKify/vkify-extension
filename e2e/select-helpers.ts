import { expect, type Locator } from '@playwright/test';

/** Exercise the visible themed listbox, using the native form value to find its label. */
export async function chooseOption(field: Locator, value: string, options?: { timeout?: number }): Promise<void> {
  const label = await field.evaluate((element, selectedValue) => {
    const native = element.parentElement?.querySelector('select');
    const option = Array.from(native?.options ?? []).find(option => option.value === selectedValue);
    if (!option) throw new Error(`Missing select option: ${selectedValue}`);
    return option.label;
  }, value);
  await field.click(options);
  const list = field.page().getByRole('listbox');
  await list.getByRole('option', { name: label, exact: true }).click();
  await expect(field).toHaveAttribute('aria-expanded', 'false');
}

export async function expectOptions(field: Locator, labels: string[]): Promise<void> {
  await field.click();
  await expect(field.page().getByRole('listbox').getByRole('option')).toHaveText(labels);
  await field.press('Escape');
}
