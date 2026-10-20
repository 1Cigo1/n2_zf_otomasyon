import { expect } from '@playwright/test';
import { ReservationForm } from '../components/reservations/reservation-form.js';
import { CustomerDriverSection } from '../components/reservations/customer-driver.section.js';
import { BillingSection } from '../components/reservations/billing.section.js';
import { AdditionalServicesSection } from '../components/reservations/additional-services.section.js';

export class CorporateShortTermPage {
  constructor(page, env) {
    this.page = page;
    this.env = env;
    this.config = env.corporateShortTerm;
    this.reservationForm = new ReservationForm(page, {
      saveTimeout: env.saveTimeout,
    });
    this.customerDriver = new CustomerDriverSection(page);
    this.billing = new BillingSection(page);
    this.additionalServices = new AdditionalServicesSection(page);

    this.search = page.getByRole('textbox', {
      name: 'Herhangi bir şey arayın',
    });
    this.createReservationButton = page.getByRole('button', {
      name: 'Rezervasyon Yap', exact: true,
    });
    this.continueButton = page.getByRole('button', {
      name: 'Devam Et', exact: true,
    });
  }

  async openContractList() {
    // Sol menü kullanıcıya göre daraltılmış veya açık gelebiliyor. Menü metnine
    // bağlı kalmadan kurumsal sözleşme listesine doğrudan gideriz.
    await this.page.goto('/reservation/corporate-list');
    await expect(this.page).toHaveURL(/\/reservation\/corporate-list/);
    await expect(this.search).toBeVisible({ timeout: 30000 });
  }

  async selectContract(contractNumber) {
    if (!contractNumber) throw new Error('Kurumsal sözleşme numarası tanımlanmalı.');
    await this.search.fill(contractNumber);
    await this.search.press('Enter');

    const row = this.page.locator('table tbody tr')
      .filter({ hasText: contractNumber }).first();
    await expect(
      row,
      `${contractNumber} numaralı kurumsal sözleşme bulunamadı`,
    ).toBeVisible({ timeout: 30000 });
    await expect(row).toContainText(contractNumber);
    await row.locator('button:has(.mdi-chevron-right)').click();
    await expect(this.createReservationButton).toBeVisible({ timeout: 30000 });
  }

  async startReservation() {
    await this.createReservationButton.click();
    await expect(this.continueButton).toBeVisible();
    await this.continueButton.click();
    await expect(this.page.getByPlaceholder(
      'Rezervasyon Bitiş Tarihi', { exact: true },
    )).toBeVisible({ timeout: 30000 });
  }

  fillEndDate(endDate) {
    return this.reservationForm.fillEndDate(endDate);
  }

  selectOfficeAndGroup() {
    return this.reservationForm.selectOfficeAndGroup();
  }

  selectCustomer(customer) {
    return this.customerDriver.selectCustomer(customer);
  }

  selectInvoiceType() {
    return this.billing.selectInvoiceType(this.config.invoiceType);
  }

  selectAdditionalServices() {
    return this.additionalServices.selectForPeriods({
      preferredService: this.config.additionalService,
    });
  }

  ensureBillingAddress(customer) {
    return this.billing.ensureAddress(customer);
  }

  async save() {
    const saved = await this.reservationForm.save();
    await expect(this.page).toHaveURL(/\/reservation\/corporate-reservation\//);
    return saved;
  }
}
