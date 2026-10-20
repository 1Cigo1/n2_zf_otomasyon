import { expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { exactText } from './form.controls.js';

const photoNames = [
  'front.jpg',
  'front-left.jpg',
  'front-right.jpg',
  'rear.jpg',
  'rear-left.jpg',
  'rear-right.jpg',
];

const fixturePath = name => fileURLToPath(
  new URL(`../test-data/photos/${name}`, import.meta.url),
);

export const DEFAULT_VEHICLE_FORM_DOCUMENT = fixturePath('front.jpg');
export const DEFAULT_VEHICLE_PHOTOS = Object.freeze(photoNames.map(fixturePath));

async function visibleCount(locator) {
  return locator.filter({ visible: true }).count();
}

async function requireOneVisible(locator, description) {
  const visible = locator.filter({ visible: true });
  const count = await visible.count();
  if (count !== 1) {
    throw new Error(`${description}: 1 görünür öğe bekleniyordu, ${count} bulundu.`);
  }
  return visible;
}

/**
 * Araç teslim/iade ekranlarının ortak dosya yükleyicisidir.
 *
 * Uygulamanın iki yükleme biçimini de destekler:
 * - tek bir input'a bir veya birden çok dosya,
 * - her fotoğraf için ayrı bir input.
 */
export class VehicleLifecycleMedia {
  constructor(page, { timeout = 15_000 } = {}) {
    this.page = page;
    this.timeout = timeout;
  }

  async upload(files, { commit = 'Kaydet', commitRequired = false } = {}) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new TypeError('Yüklenecek en az bir dosya yolu verilmelidir.');
    }

    const { root: surface, isDialog } = await this.#uploadSurface();
    const inputs = surface.locator('input[type="file"]');
    const inputCount = await inputs.count();

    if (inputCount === 1) {
      if (files.length > 1 && !await inputs.evaluate(input => input.multiple)) {
        throw new Error(
          `${files.length} fotoğraf seçilecek fakat dosya input'u çoklu seçime açık değil.`,
        );
      }
      await inputs.setInputFiles(files);
      await expect.poll(
        () => inputs.evaluate(input => input.files?.length ?? 0),
        { timeout: this.timeout, message: 'Dosyalar input alanına bağlanamadı.' },
      ).toBe(files.length);
    } else if (inputCount >= files.length) {
      for (let index = 0; index < files.length; index += 1) {
        const input = inputs.nth(index);
        await input.setInputFiles(files[index]);
        await expect.poll(
          () => input.evaluate(element => element.files?.length ?? 0),
          { timeout: this.timeout, message: `${index + 1}. dosya yüklenemedi.` },
        ).toBe(1);
      }
    } else if (inputCount === 0) {
      await this.#uploadWithFileChooser(surface, files);
    } else {
      throw new Error(
        `${files.length} dosya için tek bir çoklu input veya en az ${files.length} ` +
        `ayrı input bekleniyordu; ${inputCount} input bulundu.`,
      );
    }

    await this.#waitUntilIdle(surface);
    const commitButtons = surface
      .getByRole('button', { name: exactText(commit) })
      .filter({ visible: true });
    if (commitRequired) {
      await expect(commitButtons, `${commit}: yükleme alanında tek kayıt düğmesi olmalı`)
        .toHaveCount(1, { timeout: this.timeout });
    }
    const commitCount = await commitButtons.count();
    if (commitCount > 1) {
      throw new Error(`${commit}: yükleme alanında birden fazla görünür kayıt düğmesi bulundu.`);
    }
    if (commitCount === 1) {
      await expect(commitButtons).toBeEnabled({ timeout: this.timeout });
      await commitButtons.click();
      if (isDialog) {
        await expect(surface, `${commit}: dosya yükleme modalı kapanmalı`)
          .toBeHidden({ timeout: this.timeout });
      }
    } else if (commitRequired) {
      throw new Error(`${commit}: yükleme alanında kayıt düğmesi bulunamadı.`);
    }

    return [...files];
  }

  async #uploadSurface() {
    await expect.poll(async () => {
      const dialogs = this.page.locator('.v-dialog:visible, [role="dialog"]:visible');
      let matchingDialogs = 0;
      for (let index = 0; index < await dialogs.count(); index += 1) {
        const dialog = dialogs.nth(index);
        const uploadControls = dialog.locator('input[type="file"], .mdi-paperclip');
        if (await uploadControls.count()) matchingDialogs += 1;
      }
      if (matchingDialogs) return matchingDialogs;
      const pageControls = this.page.locator('input[type="file"], .mdi-paperclip');
      return (await pageControls.count()) ? 1 : 0;
    }, {
      timeout: this.timeout,
      message: 'Dosya yükleme alanı açılmadı.',
    }).toBeGreaterThan(0);

    const dialogs = this.page.locator('.v-dialog:visible, [role="dialog"]:visible');
    const matches = [];
    for (let index = 0; index < await dialogs.count(); index += 1) {
      const dialog = dialogs.nth(index);
      if (await dialog.locator('input[type="file"], .mdi-paperclip').count()) {
        matches.push(dialog);
      }
    }
    if (matches.length > 1) {
      throw new Error(`Dosya yüklemek için ${matches.length} etkin modal bulundu.`);
    }
    return matches.length === 1
      ? { root: matches[0], isDialog: true }
      : { root: this.page, isDialog: false };
  }

  async #uploadWithFileChooser(surface, files) {
    const icons = surface.locator('.mdi-paperclip');
    const icon = await requireOneVisible(icons, 'Dosya ekleme ataşı');
    const button = icon.locator('xpath=ancestor::*[self::button or @role="button"][1]');
    const trigger = await visibleCount(button) === 1 ? button.filter({ visible: true }) : icon;

    const chooserPromise = this.page.waitForEvent('filechooser', { timeout: this.timeout });
    await trigger.click();
    const chooser = await chooserPromise;
    await chooser.setFiles(files);
  }

  async #waitUntilIdle(surface) {
    const busy = surface.locator(
      'button[aria-busy="true"], button.v-btn--loading, .v-progress-circular:visible',
    ).filter({ visible: true });
    await expect(busy, 'Dosya yükleme göstergesi kapanmalı').toHaveCount(0, {
      timeout: this.timeout,
    });
  }
}
