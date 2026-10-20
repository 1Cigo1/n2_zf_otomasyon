import { expect } from '@playwright/test';

const normalizedToken = value => String(value ?? '')
  .normalize('NFKC')
  .replace(/[^\p{L}\p{N}]/gu, '')
  .toLocaleUpperCase('tr-TR');

async function visibleRows(locator) {
  const rows = [];
  for (let index = 0; index < await locator.count(); index += 1) {
    const row = locator.nth(index);
    if (!await row.isVisible()) continue;
    rows.push({ locator: row, text: ' '.concat(await row.innerText()).trim() });
  }
  return rows;
}

export class ReturnListPage {
  constructor(page, { timeout = 30_000 } = {}) {
    this.page = page;
    this.timeout = timeout;
  }

  async openAndSelect({
    customerIdentity,
    vehiclePlate,
    reservationCode,
    reservationId,
  }) {
    if (!/^\d{11}$/.test(String(customerIdentity))) {
      throw new TypeError('İade listesi araması için 11 haneli müşteri kimliği gereklidir.');
    }

    const isListResponse = response =>
      new URL(response.url()).pathname === '/api/short-term-rental/' &&
      response.request().method() === 'GET';
    const [initialResponse] = await Promise.all([
      this.page.waitForResponse(isListResponse, { timeout: this.timeout }),
      this.page.goto('/reservation/return-list'),
    ]);
    expect(initialResponse.status(), 'İade listesinin ilk API yanıtı').toBe(200);
    await expect(this.page).toHaveURL(url => url.pathname === '/reservation/return-list', {
      timeout: this.timeout,
    });

    const search = this.page
      .getByRole('textbox', { name: 'Herhangi bir şey arayın', exact: true })
      .or(this.page.getByPlaceholder('Herhangi bir şey arayın', { exact: true }))
      .filter({ visible: true });
    await expect(search, 'İade listesi arama alanı tek olmalı').toHaveCount(1, {
      timeout: this.timeout,
    });
    // URL hemen değişebilir; filtrelenen tablo API yanıtından sonra güncellenir.
    // İlk yükleme ve arama yanıtını ayrı bekleyerek eski tabloyu seçmeyiz.
    const [filteredResponse] = await Promise.all([
      this.page.waitForResponse(isListResponse, { timeout: this.timeout }),
      (async () => {
        await search.fill(String(customerIdentity));
        await search.press('Enter');
      })(),
    ]);
    expect(filteredResponse.status(), 'Filtrelenmiş iade listesi API yanıtı').toBe(200);

    // API yanıtından sonra URL'de de aynı müşteri filtresi kalmalı.
    await expect.poll(
      () => new URL(this.page.url()).searchParams.get('search'),
      { timeout: this.timeout, message: 'Müşteri kimliği iade listesi filtresine uygulanmadı.' },
    ).toBe(String(customerIdentity));

    const tableRows = this.page.locator('table tbody tr');
    const context = { vehiclePlate, reservationCode, reservationId };
    await this.#waitForStableMatches(tableRows, context);

    const matches = await this.#matchingRows(tableRows, context);
    if (matches.length !== 1) {
      const summaries = matches.map(({ text }) => text.replace(/\s+/g, ' ').slice(0, 180));
      throw new Error(
        `İade listesinde tek satır bekleniyordu; ${matches.length} eşleşme bulundu. ` +
        `Plaka/kod ile ayrıştırın. Eşleşmeler: ${summaries.join(' | ')}`,
      );
    }

    const action = matches[0].locator
      .locator('button:has(.mdi-file-sign)')
      .filter({ visible: true });
    const actionCount = await action.count();
    if (actionCount !== 1) {
      throw new Error(
        `Seçilen iade satırında 1 form işlemi düğmesi bekleniyordu; ${actionCount} bulundu.`,
      );
    }
    await expect(action).toBeEnabled({ timeout: this.timeout });
    await action.click();
    await expect(this.page).toHaveURL(url => /\/return\/[^/]+$/.test(url.pathname), {
      timeout: this.timeout,
    });

    return {
      rowText: matches[0].text,
      vehiclePlate: vehiclePlate || null,
      reservationCode: reservationCode || null,
      reservationId: reservationId || null,
    };
  }

  async #matchingRows(rows, { vehiclePlate, reservationCode, reservationId }) {
    const available = await visibleRows(rows);
    const plate = normalizedToken(vehiclePlate);
    const references = [reservationCode, reservationId]
      .map(normalizedToken)
      .filter(Boolean);

    let matches = available;
    if (plate) {
      matches = matches.filter(({ text }) => normalizedToken(text).includes(plate));
    }

    if (references.length) {
      const referenced = matches.filter(({ text }) => {
        const normalized = normalizedToken(text);
        return references.some(reference => normalized.includes(reference));
      });
      // Kod/id listede gösteriliyorsa ek ayrıştırıcıdır. Gösterilmiyorsa plaka
      // eşleşmesini bozmayız; canlı iade tablosunda bu değerler görünmüyor.
      if (referenced.length) matches = referenced;
    }

    if (!plate && references.length === 0 && matches.length !== 1) return [];
    return matches;
  }

  async #waitForStableMatches(rows, context) {
    const loading = this.page.locator(
      '.v-data-table .v-progress-linear:visible, ' +
      '.v-data-table [role="progressbar"]:visible, ' +
      '.v-progress-linear--active:visible',
    ).filter({ visible: true });
    let previousSignature = null;
    let stableSamples = 0;

    await expect.poll(async () => {
      if (await loading.count()) {
        previousSignature = null;
        stableSamples = 0;
        return false;
      }

      const matches = await this.#matchingRows(rows, context);
      if (matches.length === 0) {
        previousSignature = null;
        stableSamples = 0;
        return false;
      }
      const signature = matches
        .map(({ text }) => text.replace(/\s+/g, ' ').trim())
        .join('\n---\n');
      if (signature === previousSignature) stableSamples += 1;
      else stableSamples = 0;
      previousSignature = signature;
      return stableSamples >= 1; // Aynı sonuç iki ardışık kontrolde görülmelidir.
    }, {
      timeout: this.timeout,
      intervals: [100, 200, 400],
      message: this.#noMatchMessage(context),
    }).toBe(true);
  }

  #noMatchMessage({ vehiclePlate, reservationCode, reservationId }) {
    const discriminator = vehiclePlate || reservationCode || reservationId;
    if (discriminator) {
      return `İade listesinde ${discriminator} değerini içeren görünür satır bulunamadı.`;
    }
    return 'İade filtresinden sonra tek bir görünür satır elde edilemedi.';
  }
}
