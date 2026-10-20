import { expect } from '@playwright/test';
import { FormControls } from '../form.controls.js';
import { BillingAddressModal } from './billing-address.modal.js';

export class BillingSection {
  constructor(page, root = page.locator('main')) {
    this.page = page;
    this.form = new FormControls(page, root);
    this.modal = new BillingAddressModal(page);
    this.section = page.locator('#section5');
  }

  async selectInvoiceType(invoiceType) {
    if (!invoiceType) throw new Error('Kurumsal fatura tipi tanımlanmalı.');
    await this.form.choose('Fatura Tipi', { text: invoiceType });
    await expect(
      this.form.field('Fatura Tipi').locator(
        'xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " v-field ")][1]',
      ),
    ).toContainText(invoiceType);
  }

  async ensureAddress(customer) {
    await expect(this.section).toBeVisible();
    await this.section.scrollIntoViewIfNeeded();

    const name = this.section.getByText('İsim', { exact: true }).locator('..');
    const normalizedName = (await name.innerText()).replace(/\s/g, '');
    if (!['İsim', 'İsim-', 'İsim—', 'İsim–'].includes(normalizedName)) {
      return { addressAdded: false };
    }

    await this.page.getByText('Fatura Adresi Bilgileri', { exact: true })
      .locator('xpath=./ancestor::div[3]').locator('button').first().click();
    await this.page.getByRole('button', {
      name: 'Yeni Adres Ekle / Adresi Düzenle', exact: true,
    }).click();
    await this.page.getByRole('button', { name: /^Adres Ekle$/i }).click();
    await this.modal.fill(customer);

    await expect(this.section).toContainText(customer.identity);
    if (customer.firstName) await expect(this.section).toContainText(customer.firstName);
    await expect(
      this.page.locator('.v-dialog[role="dialog"]:visible'),
    ).toHaveCount(0);
    return { addressAdded: true };
  }
}
