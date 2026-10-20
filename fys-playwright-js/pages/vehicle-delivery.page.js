import { expect } from '@playwright/test';
import { exactText } from '../components/form.controls.js';
import {
  DEFAULT_VEHICLE_FORM_DOCUMENT,
  DEFAULT_VEHICLE_PHOTOS,
  VehicleLifecycleMedia,
} from '../components/vehicle-lifecycle.media.js';

const platePattern = /^\d{2}\s*[A-ZÇĞİÖŞÜ]{1,3}\s*\d{2,4}$/iu;

async function oneVisible(locator, description, timeout) {
  const visible = locator.filter({ visible: true });
  await expect(visible, `${description}: tek bir görünür öğe olmalı`).toHaveCount(1, {
    timeout,
  });
  return visible;
}

export class VehicleDeliveryPage {
  constructor(page, { timeout = 15_000, media } = {}) {
    this.page = page;
    this.timeout = timeout;
    this.media = media ?? new VehicleLifecycleMedia(page, { timeout });
  }

  async complete({
    damageNote = 'aracın bir hasarı bulunmamıştır',
    formDocument = DEFAULT_VEHICLE_FORM_DOCUMENT,
    vehiclePhotos = DEFAULT_VEHICLE_PHOTOS,
  } = {}) {
    const damage = await oneVisible(
      this.page.getByRole('textbox', {
        name: /^Teslim Hasar Detayı(?: Teslim(?: Hasar Detayı)?)?$/i,
      }),
      'Teslim hasar detayı',
      this.timeout,
    );
    await damage.fill(damageNote);
    await expect(damage).toHaveValue(damageNote);

    const plate = await this.readVehiclePlate({ required: false });
    await this.#clickAction('Form Bilgilerini Kaydet');

    await this.#clickAction('Formu Yükle');
    await this.media.upload([formDocument], {
      commit: 'Kaydet',
      commitRequired: true,
    });

    await this.#clickAction('Kiraya Yönlendir');
    await this.media.upload([...vehiclePhotos], { commit: 'Kaydet' });

    return {
      plate,
      damageNote,
      formDocument,
      vehiclePhotos: [...vehiclePhotos],
    };
  }

  async readVehiclePlate({ required = true } = {}) {
    const labelled = this.page
      .getByLabel(/^Araç Plakası$/i)
      .filter({ visible: true });
    const labelledCount = await labelled.count();
    if (labelledCount > 1) {
      throw new Error(`Araç Plakası etiketi ${labelledCount} görünür alanla eşleşti.`);
    }
    if (labelledCount === 1) {
      const value = (await labelled.inputValue()).trim();
      if (platePattern.test(value)) return value.replace(/\s+/g, '').toUpperCase();
      throw new Error(`Araç Plakası alanındaki değer plaka biçiminde değil: ${value}`);
    }

    // Bazı teslim ekranlarında etiket input'a bağlanmıyor. DOM sırasına göre
    // ikinci alanı almak yerine yalnız plaka biçimine uyan kapalı metin alanı seçilir.
    const disabledTextInputs = this.page.locator(
      'input[type="text"]:disabled, input[type="text"][readonly]',
    );
    const matches = [];
    for (let index = 0; index < await disabledTextInputs.count(); index += 1) {
      const input = disabledTextInputs.nth(index);
      if (!await input.isVisible()) continue;
      const value = (await input.inputValue()).trim();
      if (platePattern.test(value)) matches.push({ input, value });
    }
    if (matches.length === 1) {
      return matches[0].value.replace(/\s+/g, '').toUpperCase();
    }
    if (matches.length > 1) {
      throw new Error(`Teslim formunda plaka biçimine uyan ${matches.length} alan bulundu.`);
    }
    if (required) {
      throw new Error('Teslim formunda Araç Plakası alanı bulunamadı.');
    }
    return null;
  }

  async #clickAction(name) {
    const button = await oneVisible(
      this.page.getByRole('button', { name: exactText(name) }),
      name,
      this.timeout,
    );
    await expect(button).toBeEnabled({ timeout: this.timeout });
    await button.click();
  }
}
