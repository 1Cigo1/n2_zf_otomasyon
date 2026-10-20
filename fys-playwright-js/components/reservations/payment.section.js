import { expect } from '@playwright/test';

export class PaymentSection {
  constructor(page) {
    this.page = page;
    this.payLaterCheckbox = page.getByRole('checkbox', {
      name: 'Ödemeyi Sonra Al', exact: true,
    });
  }

  async deferPayment() {
    if (!(await this.payLaterCheckbox.isChecked())) {
      await this.payLaterCheckbox.check();
      await this.page.getByRole('button', { name: /^Evet$/i }).click();
    }
    await expect(this.payLaterCheckbox).toBeChecked();
  }
}
