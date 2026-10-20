import { expect } from '@playwright/test';

export const exactText = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

export class FormControls {
  constructor(page, root = page) { this.page = page; this.root = root; }
  field(label) {
    const labelled = this.root.getByLabel(label, { exact: true });
    const wrapped = this.root.locator('.v-field').filter({
      has: this.page.locator('label').filter({ hasText: exactText(label) }),
    }).locator('input, textarea');
    return labelled.or(wrapped).first();
  }
  button(name) { return this.root.getByRole('button', { name: exactText(name) }); }
  async fillAndChoose(label, value) {
    const input = this.field(label);
    await expect(input, `${label}: alan görünür olmalı`).toBeVisible();
    await input.click();
    await input.fill(value);
    await expect(input).toHaveValue(value);

    // Autocomplete alanında yalnızca yazmak yeterli değildir. Görünen metnin
    // arkasındaki ofis/araç grubu ID'sinin forma bağlanması için seçenek seçilir.
    const options = this.page.locator(
      '[role="listbox"]:visible [role="option"]:visible',
    );
    const choice = options.filter({ hasText: exactText(value) });
    await expect(
      choice,
      `${label}: yazılan değer tek bir seçenekle eşleşmeli (${value})`,
    ).toHaveCount(1);
    await expect(choice).toBeVisible();
    await choice.click();
    await expect(input).toHaveValue(value);
    return value;
  }
  async choose(label, { text, search } = {}) {
    const input = this.field(label);
    const field = input.locator(
      'xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " v-field ")][1]',
    );
    if (await field.count()) await field.click();
    else await input.click();
    if (search) await input.fill(search);
    const options = this.page.locator('[role="listbox"]:visible [role="option"]:visible');
    const choice = text ? options.filter({ hasText: exactText(text) }) : options.first();
    if (text) await expect(choice, `${label}: seçenek tekil olmalı (${text})`).toHaveCount(1);
    await expect(choice).toBeVisible();
    const selected = await choice.innerText();
    await choice.click();
    return selected.trim();
  }
  async fill(label, value) {
    await this.field(label).fill(value);
    await this.field(label).press('Tab');
  }
}
