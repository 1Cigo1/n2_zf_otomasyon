import { expect } from '@playwright/test';
import { FormControls } from '../form.controls.js';
import { DriverLicenseModal } from './driver-license.modal.js';

export class CustomerDriverSection {
  constructor(page, root = page.locator('main')) {
    this.page = page;
    this.form = new FormControls(page, root);
    this.licenseModal = new DriverLicenseModal(page);
  }

  async selectCustomer(customer) {
    if (!customer.identity) {
      throw new Error('Rezervasyon müşterisinin kimlik numarası tanımlanmalı.');
    }

    await this.form.field('Müşteri').fill(customer.identity);
    const option = this.page.getByRole('option').filter({
      hasText: customer.identity,
    });
    await expect(option, 'Müşteri kimliği tek bir seçenekle eşleşmeli').toHaveCount(1);

    const [response] = await Promise.all([
      this.page.waitForResponse(response =>
        new URL(response.url()).pathname.endsWith('/short-term-rental/check-driver/') &&
        response.request().method() === 'GET',
      { timeout: 30000 }),
      option.click(),
    ]);

    expect(response.status(), 'Müşteri ehliyet kontrolü').toBe(200);
    const customerId = new URL(response.url()).searchParams.get('customer');
    const licenseTitle = this.licenseModal.dialog
      .getByText('Sürücü Ekle', { exact: true });
    const driverField = this.form.field('Sürücü');
    const currentDriverState = async () => {
      if (await licenseTitle.isVisible().catch(() => false)) return 'missing';
      if (await driverField.count() > 0) {
        const value = await driverField.inputValue().catch(() => '');
        if (value) return 'existing';
      }
      return 'waiting';
    };

    await expect.poll(currentDriverState, {
      message: 'Ehliyet modalı veya mevcut sürücü bilgisi bekleniyor',
      timeout: 15000,
    }).not.toBe('waiting');
    const driverState = await currentDriverState();

    let licenseAdded = false;

    if (driverState === 'missing') {
      await this.licenseModal.fill(customer);
      licenseAdded = true;
    } else {
      await expect(driverField).toHaveValue(/.+/);
    }

    await expect(
      this.page.locator('.v-dialog[role="dialog"]:visible'),
    ).toHaveCount(0);

    return { customerId, licenseAdded };
  }
}
