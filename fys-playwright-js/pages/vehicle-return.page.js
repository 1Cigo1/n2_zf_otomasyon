import { expect } from '@playwright/test';
import { exactText } from '../components/form.controls.js';
import {
  DEFAULT_VEHICLE_FORM_DOCUMENT,
  DEFAULT_VEHICLE_PHOTOS,
  VehicleLifecycleMedia,
} from '../components/vehicle-lifecycle.media.js';
import { parseKm } from '../support/values.js';

const deliveryKmLabel = /(Teslim.*(?:KM|Kilometre)|(?:KM|Kilometre).*Teslim)/iu;
const returnKmLabel = /(İade.*(?:KM|Kilometre)|(?:KM|Kilometre).*İade)/iu;
const returnFuelLabel = /(İade.*Yakıt|Yakıt.*İade)/iu;

async function oneVisible(locator, description, timeout) {
  const visible = locator.filter({ visible: true });
  await expect(visible, `${description}: tek bir görünür öğe olmalı`).toHaveCount(1, {
    timeout,
  });
  return visible;
}

export class VehicleReturnPage {
  constructor(page, {
    timeout = 15_000,
    confirmationTimeout = 2_000,
    media,
  } = {}) {
    this.page = page;
    this.timeout = timeout;
    this.confirmationTimeout = confirmationTimeout;
    this.media = media ?? new VehicleLifecycleMedia(page, { timeout });
  }

  async complete({
    kmIncrease = 30,
    fuelAmount = 2,
    damageNote = 'aracın yeni hasarı yok',
    formDocument = DEFAULT_VEHICLE_FORM_DOCUMENT,
    vehiclePhotos = DEFAULT_VEHICLE_PHOTOS,
  } = {}) {
    if (!Number.isSafeInteger(kmIncrease) || kmIncrease < 0) {
      throw new TypeError('İade KM artışı sıfır veya pozitif bir tam sayı olmalıdır.');
    }
    if (!Number.isFinite(Number(fuelAmount)) || Number(fuelAmount) < 0) {
      throw new TypeError('İade yakıt miktarı sıfır veya pozitif bir sayı olmalıdır.');
    }

    const damage = await oneVisible(
      this.page.getByRole('textbox', {
        name: /^İade Hasar Detayı(?: İade(?: Hasar Detayı)?)?$/i,
      }),
      'İade hasar detayı',
      this.timeout,
    );
    // Route kabuğu alanları önce boş ve disabled olarak çiziyor. Form verisi
    // geldikten sonra iade alanı etkinleşir; iskelet DOM'u hazır form sanmayız.
    await expect(damage, 'İade form verileri yüklenmeli ve hasar alanı açılmalı')
      .toBeEnabled({ timeout: this.timeout });
    await expect.poll(
      () => this.page.locator(
        'input[type="number"]:visible:not([disabled]):not([readonly])',
      ).count(),
      {
        timeout: this.timeout,
        message: 'İade KM ve yakıt alanları yüklenip düzenlenebilir olmalı.',
      },
    ).toBe(2);
    const scope = await this.#returnFormScope(damage);
    const fields = await this.#numericFields(scope);
    const deliveryKm = parseKm(await fields.deliveryKm.inputValue());
    const returnKm = deliveryKm + kmIncrease;

    await fields.returnKm.fill(String(returnKm));
    await fields.returnKm.blur();
    await fields.returnFuel.fill(String(fuelAmount));
    await fields.returnFuel.blur();
    await expect(fields.returnKm, 'İade KM değeri inputta kalmalı')
      .toHaveValue(String(returnKm));
    await expect(fields.returnFuel, 'İade yakıt değeri inputta kalmalı')
      .toHaveValue(String(fuelAmount));

    await damage.fill(damageNote);
    await expect(damage).toHaveValue(damageNote);
    await this.#clickAction('Form Bilgilerini Kaydet');

    const confirmation = await this.#waitForOptionalAction(
      'Tamam',
      this.confirmationTimeout,
    );
    if (confirmation) {
      await confirmation.click();
      await expect(confirmation, 'İade onayı kapandıktan sonra akış bitmeli')
        .toBeHidden({ timeout: this.timeout });
      return { mode: 'confirmed', deliveryKm, returnKm, fuelAmount: Number(fuelAmount) };
    }

    await this.#completeWizard({ formDocument, vehiclePhotos });
    return { mode: 'wizard', deliveryKm, returnKm, fuelAmount: Number(fuelAmount) };
  }

  async #returnFormScope(damage) {
    const nearest = damage.locator(
      'xpath=ancestor::*[count(.//input[@type="number"]) >= 3][1]',
    );
    if (await nearest.count() === 1) return nearest;

    const form = this.page.locator('form:visible').filter({ has: damage });
    if (await form.count() === 1 && await form.locator('input[type="number"]').count() >= 3) {
      return form;
    }

    const main = this.page.locator('main:visible, [role="main"]:visible').filter({ has: damage });
    if (await main.count() === 1 && await main.locator('input[type="number"]').count() >= 3) {
      return main;
    }
    throw new Error(
      'İade hasar alanıyla aynı formda teslim KM, iade KM ve yakıt alanları bulunamadı.',
    );
  }

  async #numericFields(scope) {
    const numbers = scope.locator('input[type="number"]');
    const records = [];
    for (let index = 0; index < await numbers.count(); index += 1) {
      const locator = numbers.nth(index);
      if (!await locator.isVisible()) continue;
      const metadata = await locator.evaluate(element => {
        const labels = [...(element.labels ?? [])].map(label => label.textContent ?? '');
        const wrapper = element.closest('.v-input, .v-field, [role="group"]');
        return {
          locked: element.disabled || element.readOnly,
          description: [
            element.getAttribute('aria-label') ?? '',
            element.getAttribute('placeholder') ?? '',
            ...labels,
            wrapper?.textContent ?? '',
          ].join(' ').replace(/\s+/g, ' ').trim(),
        };
      });
      records.push({ locator, ...metadata });
    }

    const locked = records.filter(record => record.locked);
    const editable = records.filter(record => !record.locked);
    const deliveryMatches = locked.filter(record => deliveryKmLabel.test(record.description));
    let resolvedDelivery = deliveryMatches;
    if (resolvedDelivery.length === 0 && locked.length === 2 && editable.length === 2) {
      // Canlı Vuetify formunda etiketler input wrapper'ında değil, komşu grid
      // hücresindedir. Tam 2 kapalı + 2 açık alan şartında formun kendi sırası:
      // teslim KM, teslim yakıtı, iade KM, iade yakıtıdır.
      resolvedDelivery = [locked[0]];
    }
    if (resolvedDelivery.length !== 1) {
      throw new Error(
        `Teslim KM alanı etiketinden tekil bulunamadı. ` +
        `Kapalı sayı alanları: ${locked.map(record => record.description || '(etiketsiz)').join(' | ')}`,
      );
    }

    let returnMatches = editable.filter(record => returnKmLabel.test(record.description));
    let fuelMatches = editable.filter(record => returnFuelLabel.test(record.description));
    if (returnMatches.length > 1 || fuelMatches.length > 1) {
      throw new Error('İade KM veya iade yakıt etiketi birden fazla sayı alanıyla eşleşti.');
    }

    // Yalnız bir alan etiketliyse, aynı dar form scope'unda kalan tek alanı
    // diğer değer olarak kullanırız. İkisi de etiketsizse tam iki editable alan
    // şartıyla DOM form sırası (KM, yakıt) son çaredir; global input sırası değildir.
    if (returnMatches.length === 1 && fuelMatches.length === 0) {
      fuelMatches = editable.filter(record => record !== returnMatches[0]);
    } else if (fuelMatches.length === 1 && returnMatches.length === 0) {
      returnMatches = editable.filter(record => record !== fuelMatches[0]);
    } else if (returnMatches.length === 0 && fuelMatches.length === 0 && editable.length === 2) {
      [returnMatches, fuelMatches] = [[editable[0]], [editable[1]]];
    }

    if (returnMatches.length !== 1 || fuelMatches.length !== 1 ||
        returnMatches[0] === fuelMatches[0]) {
      throw new Error(
        `İade KM ve yakıt alanları tekil bulunamadı. ` +
        `Düzenlenebilir sayı alanları: ${editable.map(record => record.description || '(etiketsiz)').join(' | ')}`,
      );
    }

    return {
      deliveryKm: resolvedDelivery[0].locator,
      returnKm: returnMatches[0].locator,
      returnFuel: fuelMatches[0].locator,
    };
  }

  async #completeWizard({ formDocument, vehiclePhotos }) {
    await this.#clickAction('Formu Yükle');
    await this.media.upload([formDocument], {
      commit: 'Kaydet',
      commitRequired: true,
    });
    await this.#clickAction('Tamamla');
    await this.#clickAction('İLERİ');
    await this.media.upload([...vehiclePhotos], { commit: 'Kaydet' });
    await this.#clickAction('İLERİ');

    const washing = await oneVisible(
      this.page.getByRole('radio', { name: exactText('Normal Yıkama') }),
      'Normal Yıkama',
      this.timeout,
    );
    await washing.check();
    await expect(washing).toBeChecked();
    await this.#clickAction('İLERİ');

    const fuel = await oneVisible(
      this.page.getByRole('radio', { name: exactText('Yakıt Alınacak') }),
      'Yakıt Alınacak',
      this.timeout,
    );
    await fuel.check();
    await expect(fuel).toBeChecked();
    const finalSave = await this.#action('Kaydet');
    const startingUrl = this.page.url();
    await finalSave.click();
    await expect.poll(async () => {
      if (!await finalSave.isVisible()) return true;
      if (this.page.url() !== startingUrl) return true;
      const success = this.page.locator(
        '.p-toast-message-success:visible, .v-alert.bg-success:visible, ' +
        '.v-snackbar.text-success:visible, .v-snackbar .text-success:visible',
      );
      const successText = this.page
        .locator('.v-snackbar:visible, .v-alert:visible')
        .filter({ hasText: /başarı|tamamlandı/i });
      return await success.count() > 0 || await successText.count() > 0;
    }, {
      timeout: this.timeout,
      message: 'İade wizardı Kaydet işleminden sonra kapanmadı veya başarı bildirmedi.',
    }).toBe(true);
  }

  async #waitForOptionalAction(name, timeout) {
    const candidate = this.page
      .getByRole('button', { name: exactText(name) })
      .filter({ visible: true });
    try {
      await candidate.waitFor({ state: 'visible', timeout });
    } catch (error) {
      if (error?.name === 'TimeoutError') return null;
      throw error;
    }
    return oneVisible(candidate, name, this.timeout);
  }

  async #clickAction(name) {
    const button = await this.#action(name);
    await button.click();
  }

  async #action(name) {
    const button = await oneVisible(
      this.page.getByRole('button', { name: exactText(name) }),
      name,
      this.timeout,
    );
    await expect(button).toBeEnabled({ timeout: this.timeout });
    return button;
  }
}
