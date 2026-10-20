import { expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { testDataFixture } from './file-upload.js';

function testFile(name) {
  const file = testDataFixture(`fayt/${name}`);
  if (!existsSync(file)) throw new Error(`Test dosyası bulunamadı: ${name}`);
  return file;
}

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}

function addDays(date, count) {
  const result = new Date(date);
  result.setDate(result.getDate() + count);
  return result;
}

async function visible(locator, timeout = 10000) {
  try {
    await locator.waitFor({ state: 'visible', timeout });
    return true;
  } catch (error) {
    if (error.name === 'TimeoutError') return false;
    throw error;
  }
}

async function fileUpload(page, names) {
  const files = names.map(testFile);
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.mdi-paperclip').first().click();
  await (await chooser).setFiles(files);
  const save = page.getByRole('button', { name: 'Kaydet', exact: true }).first();
  if (await visible(save, files.length > 1 ? 3000 : 30000)) await save.click();
}

async function uploadSeparate(container, names, selector = "input[type='file']") {
  const inputs = container.locator(selector);
  if (await inputs.count() < names.length) {
    throw new Error(`${names.length} fotoğraf alanı bekleniyordu; ${await inputs.count()} bulundu.`);
  }
  for (let i = 0; i < names.length; i++) await inputs.nth(i).setInputFiles(testFile(names[i]));
  const loading = container.locator("button.v-btn--loading, button[aria-busy='true']").first();
  if (await visible(loading, 500)) await loading.waitFor({ state: 'hidden', timeout: 15000 });
}

async function uploadMultiple(container, name, names, selector = "input[type='file']") {
  const input = container.locator(selector).first();
  await input.waitFor({ state: 'attached', timeout: 5000 });
  if (await input.getAttribute('multiple') === null) throw new Error(`${name} alanı çoklu dosya kabul etmiyor.`);
  await input.setInputFiles(names.map(testFile));
  const loading = container.locator("button.v-btn--loading, button[aria-busy='true']").first();
  if (await visible(loading, 500)) await loading.waitFor({ state: 'hidden', timeout: 15000 });
}

export { expect, testFile, formatDate, addDays, visible, fileUpload, uploadSeparate, uploadMultiple };
