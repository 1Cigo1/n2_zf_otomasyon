import { expect } from '@playwright/test';
import { ReservationForm } from '../components/reservations/reservation-form.js';
import { CustomerDriverSection } from '../components/reservations/customer-driver.section.js';
import { BillingSection } from '../components/reservations/billing.section.js';
import { PaymentSection } from '../components/reservations/payment.section.js';

export class ShortTermPage {
  constructor(page, env) {
    this.page = page;
    this.env = env;
    this.reservationForm = new ReservationForm(page, {
      saveTimeout: env.saveTimeout,
    });
    this.customerDriver = new CustomerDriverSection(page);
    this.billing = new BillingSection(page);
    this.payment = new PaymentSection(page);
  }

  async openNew() {
    await this.page.locator('a[href="/reservation"]').click();
    await expect(this.page).toHaveURL(/\/reservation\/reservation-list/);
    await expect(this.page.getByRole('heading', {
      name: 'Rezervasyon İşlemleri', exact: true,
    })).toHaveCount(2);
    await this.page.getByRole('button', { name: /^Yeni$/i }).click();
    await expect(this.page).toHaveURL(/\/reservation\/edit-vehicle-process/);
    await expect(this.page.getByPlaceholder(
      'Rezervasyon Başlangıç Tarihi', { exact: true },
    )).toBeVisible();
  }

  fillDates(dates) {
    return this.reservationForm.fillDates(dates);
  }

  selectOfficeAndGroup() {
    return this.reservationForm.selectOfficeAndGroup();
  }

  async selectCustomerAndCheckLicense(customer) {
    const state = await this.customerDriver.selectCustomer(customer);
    customer.id = state.customerId;
    customer.licenseAdded = state.licenseAdded;
    return state;
  }

  payLater() {
    return this.payment.deferPayment();
  }

  async ensureBillingAddress(customer) {
    const state = await this.billing.ensureAddress(customer);
    customer.billingAddressAdded = state.addressAdded;
    return state;
  }

  async save(result) {
    const saved = await this.reservationForm.save();
    await expect(this.page).toHaveURL(
      new RegExp(`/reservation/edit/${saved.id}$`),
    );
    Object.assign(result, saved, { saved: true });
    return saved;
  }
}
