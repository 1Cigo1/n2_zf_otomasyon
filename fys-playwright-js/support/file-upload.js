import { expect } from '@playwright/test';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exactText } from '../components/form.controls.js';

const TEST_DATA_DIRECTORY = fileURLToPath(new URL('../test-data/', import.meta.url));

/**
 * Resolves a fixture independently from the process working directory.
 * Traversing outside test-data is rejected so CI and local runs use the same file.
 */
export function testDataFixture(relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.trim()) {
    throw new TypeError('Fixture yolu boş olmayan bir metin olmalı.');
  }

  const resolvedPath = resolve(TEST_DATA_DIRECTORY, relativePath);
  const pathInsideTestData = relative(TEST_DATA_DIRECTORY, resolvedPath);
  const escapesTestData = pathInsideTestData === '..' ||
    pathInsideTestData.startsWith(`..${sep}`) ||
    isAbsolute(pathInsideTestData);

  if (escapesTestData) {
    throw new Error(`Fixture test-data dizininin dışında olamaz: ${relativePath}`);
  }

  return resolvedPath;
}

export const DEFAULT_CONTRACT_DOCUMENT = testDataFixture('photos/front.jpg');

export class SingleFileUpload {
  constructor(page, { timeout = 30000 } = {}) {
    this.page = page;
    this.timeout = timeout;
  }

  /**
   * Selects exactly one file input inside the supplied modal and saves it.
   * The method intentionally never falls back to a page-wide input.
   */
  async uploadAndSave(scope, {
    filePath = DEFAULT_CONTRACT_DOCUMENT,
    saveButtonName = 'Kaydet',
  } = {}) {
    await expect(scope, 'Dosya yükleme modalı tekil olmalı').toHaveCount(1, {
      timeout: this.timeout,
    });
    await expect(scope, 'Dosya yükleme modalı görünür olmalı').toBeVisible({
      timeout: this.timeout,
    });

    const input = scope.locator('input[type="file"]');
    await expect(
      input,
      'Dosya yükleme modalında tek bir file input olmalı',
    ).toHaveCount(1, { timeout: this.timeout });
    await expect(input).toBeAttached();

    await input.setInputFiles(filePath);
    const expectedFileName = basename(filePath);
    await expect.poll(
      () => input.evaluate(element => ({
        count: element.files?.length ?? 0,
        name: element.files?.[0]?.name ?? '',
      })),
      {
        message: `Yüklenecek dosya input'a bağlanmalı: ${expectedFileName}`,
        timeout: this.timeout,
      },
    ).toEqual({ count: 1, name: expectedFileName });

    await expect(scope.locator(
      'button[aria-busy="true"], button.v-btn--loading',
    )).toHaveCount(0, { timeout: this.timeout });

    const saveButton = scope.getByRole('button', {
      name: exactText(saveButtonName),
    });
    await expect(
      saveButton,
      `${saveButtonName}: yükleme modalında tek bir kayıt düğmesi olmalı`,
    ).toHaveCount(1, { timeout: this.timeout });
    await expect(saveButton).toBeEnabled();

    const originalModal = await scope.elementHandle();
    if (!originalModal) throw new Error('Dosya yükleme modalı DOM üzerinde bulunamadı.');

    try {
      await saveButton.click();
      await expect.poll(
        () => originalModal.isVisible(),
        {
          message: `${saveButtonName} sonrasında dosya yükleme modalı kapanmalı`,
          timeout: this.timeout,
        },
      ).toBe(false);
    } finally {
      await originalModal.dispose();
    }

    return { filePath, fileName: expectedFileName };
  }
}
