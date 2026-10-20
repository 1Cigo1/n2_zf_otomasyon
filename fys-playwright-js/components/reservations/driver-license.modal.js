import { expect } from '@playwright/test';
import { FormControls } from '../form.controls.js';

const requiredFields = [
  'province', 'district', 'licenseNumber', 'licenseDate',
];

export class DriverLicenseModal {
  constructor(page) {
    this.page = page;
  }

  get dialog() {
    return this.page.locator('.v-dialog[role="dialog"]:visible').last();
  }

  async fill(customer) {
    const missing = requiredFields.filter(field => !customer[field]);
    if (missing.length) {
      throw new Error(
        `Ehliyet modalı açıldı fakat müşteri verileri eksik: ${missing.join(', ')}`,
      );
    }

    const form = new FormControls(this.page, this.dialog);
    await form.choose('Doğum Yeri (Ülke)', {
      text: customer.country || 'Turkey',
      search: customer.country || 'Turkey',
    });
    await form.choose('Doğum Yeri (İl)', { text: customer.province });
    await form.choose('Doğum Yeri (İlçe)', { text: customer.district });
    await form.fill('Ehliyet No', customer.licenseNumber);

    const date = this.dialog.getByPlaceholder(
      'Ehliyet Veriliş Tarihi',
      { exact: true },
    );
    await date.fill(customer.licenseDate);
    await date.press('Tab');
    await form.button('Kaydet').click();
    await expect(this.dialog).toBeHidden({ timeout: 30000 });
  }
}
