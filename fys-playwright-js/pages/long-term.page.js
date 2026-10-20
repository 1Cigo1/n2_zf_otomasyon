import { expect } from '@playwright/test';

// Python'daki uzun dönem akışının JavaScript karşılığı.
export class LongTermPage {
  constructor(page) { this.page = page; }

  async open() {
    await this.page.getByTitle('Uzun Dönem Kiralama').click();
    await expect(this.page.getByRole('button', { name: 'Yeni', exact: true })).toBeVisible();
  }

  async createContract(customerName) {
    await this.page.getByRole('button', { name: 'Yeni', exact: true }).click();
    await this.page.getByRole('dialog').getByRole('button', { name: 'Aç' })
      .locator('..').first().click({ force: true });
    const customerOption = this.page.getByRole('option').filter({ hasText: customerName }).first();
    await expect(customerOption, 'Sözleşme için yapılandırılan müşteri listede bulunmalı').toBeVisible();
    await customerOption.click({ force: true });
    await this.page.getByRole('textbox', { name: 'Sözleşme Adı Sözleşme Adı' })
      .fill('yeni sözleşme');
    await this.page.getByRole('textbox', { name: 'Sözleşme Açıklaması Sözleşme' })
      .fill('sözleşme yapıldı');
    await this.page.getByRole('button', { name: 'Kaydet' }).click();
  }

  async openContract(customerName) {
    const row = this.page.locator('table tbody tr').filter({ hasText: customerName }).first();
    await expect(row).toBeVisible();
    await row.dblclick();
  }

  async addVehicleGroup(title) {
    await this.page.getByRole('button', { name: 'Yeni', exact: true }).click({ force: true });
    await this.page.getByRole('textbox', { name: 'İlgili Ofis İlgili Ofis' }).click();
    await this.page.getByRole('option', { name: 'Genel Merkez', exact: true }).click();
    await this.page.getByRole('spinbutton', { name: 'Aylık fiyat (KDV Hariç) Aylık' })
      .fill('23400000');
    await this.page.getByRole('textbox', { name: 'Araç Grubu Başlığı Araç Grubu' }).fill(title);
    await this.page.getByRole('textbox', { name: 'Araç Grubu Açıklaması Araç' })
      .fill('yeni arac grubu');
    await this.page.getByRole('button', { name: 'Kaydet' }).click();
  }

  async addVehicle(groupTitle) {
    const group = this.page.getByText(groupTitle, { exact: true }).first();
    await expect(group).toBeVisible();
    await group.dblclick();
    await this.page.getByRole('link', { name: 'Kiralanan Araçlar' }).click();
    await this.page.getByRole('button', { name: 'Yeni', exact: true }).click();
    await this.page.getByRole('textbox', { name: 'Araç Grubu Araç Grubu' }).click();
    const groupOption = this.page.getByRole('option').filter({ hasText: groupTitle }).first();
    await expect(groupOption, 'Yeni oluşturulan araç grubu listede bulunmalı').toBeVisible();
    await groupOption.click();
    await this.page.getByRole('textbox', { name: 'Araç Araç' }).click();
    await this.page.getByRole('option').first().click();
    await this.page.getByRole('combobox', { name: 'Araç Teslim Tarihi (Manuel' }).click();
    await this.page.getByRole('gridcell').first().click();
    await this.page.getByRole('button', { name: 'Kaydet' }).click();
  }
}
