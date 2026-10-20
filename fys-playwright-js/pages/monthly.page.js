import { expect } from '@playwright/test';
import { DriverLicenseModal } from '../components/reservations/driver-license.modal.js';
import { BillingAddressModal } from '../components/reservations/billing-address.modal.js';

function addThirtyDayPeriods(startText, count = 2) {
  const [day, month, year] = startText.split('.').map(Number);
  if (!day || !month || !year || count < 1) throw new Error('Aylık başlangıç tarihi veya dönem sayısı geçersiz.');
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 30 * count);
  return [date.getDate(), date.getMonth() + 1, date.getFullYear()]
    .map((part, index) => index < 2 ? String(part).padStart(2, '0') : String(part)).join('.');
}

export class MonthlyPage {
  constructor(page, env) { this.page = page; this.env = env; }

  async open() {
    await this.page.locator("a[href='/reservation']").click();
    await this.page.getByRole('link', { name: /Aylık Rezervasyon Listesi$/ }).click();
    await this.page.getByRole('button', { name: 'Yeni' }).click();
    await expect(this.page).toHaveURL(/\/reservation\/monthly-reservation$/);
  }

  async chooseDates() {
    const start = this.page.getByPlaceholder('Başlangıç tarihi', { exact: true });
    const end = this.page.getByPlaceholder('Bitiş tarihi', { exact: true });
    const endDate = addThirtyDayPeriods((await start.inputValue()).trim(), this.env.monthly.periodCount || 2);
    await end.fill(endDate);
    await end.press('Tab');
    await expect(end).toHaveValue(endDate);
    const startTime = (await this.page.getByPlaceholder('Başlangıç saati', { exact: true }).inputValue()).trim();
    if (startTime) {
      const endTime = this.page.getByPlaceholder('Bitiş saati', { exact: true });
      await endTime.fill(startTime);
      await endTime.press('Tab');
      await expect(endTime).toHaveValue(startTime);
    }
    return endDate;
  }

  async chooseField(name, value) {
    const field = this.page.getByRole('textbox', { name: new RegExp(`^${name}(?:\\s|$)`) });
    await field.fill(value);
    const option = this.page.getByRole('option').filter({ hasText: value }).first();
    await expect(option).toBeVisible();
    await option.click();
  }

  async chooseVehicle() {
    await this.page.getByRole('textbox', { name: /^Araç(?:\s|$)/ }).click();
    const options = this.page.getByRole('option');
    await expect(options.first()).toBeVisible();
    const candidates = [];
    for (let i = 0; i < await options.count(); i++) {
      const option = options.nth(i);
      if (await option.isVisible() && await option.isEnabled()
        && /\d{2}[A-ZÇĞİÖŞÜ]{1,3}\d{2,4}/.test(await option.innerText())) candidates.push(option);
    }
    if (!candidates.length) throw new Error('SKODA SUPERB için seçilebilir araç bulunamadı.');
    const option = candidates[Math.floor(Math.random() * candidates.length)];
    const plate = (await option.innerText()).trim().split(' - ')[0];
    await option.click();
    return plate;
  }

  async chooseCustomer() {
    const identity = this.env.monthly.customerIdentityNo;
    if (!identity) throw new Error('MONTHLY_CUSTOMER_IDENTITY_NO eksik.');
    await this.chooseField('Müşteri', identity);
    const licenseDate = this.page.getByPlaceholder('Ehliyet Veriliş Tarihi', { exact: true });
    // Bazı müşterilerin ehliyeti kayıtlıdır; bu durumda modal açılmaz.
    let licenseOpened = false;
    try {
      await licenseDate.waitFor({ state: 'visible', timeout: 3000 });
      licenseOpened = true;
    } catch (error) {
      if (error.name !== 'TimeoutError') throw error;
    }
    if (licenseOpened) {
      await new DriverLicenseModal(this.page).fill(this.env.monthly.customer);
    }
  }

  async chooseAdditionalService() {
    await expect(this.page.getByRole('heading', { name: 'Ek hizmetler ve özel fiyat' })).toBeVisible();
    await this.page.getByRole('button', { name: 'Tüm rezervasyonlar' }).click();
    const buttons = this.page.getByRole('button');
    const services = [];
    for (let i = 0; i < await buttons.count(); i++) {
      const button = buttons.nth(i);
      if (!await button.isVisible() || !await button.isEnabled()) continue;
      const text = (await button.innerText()).replace(/\s+/g, ' ').trim();
      const match = text.match(/^(.+?)\s+\d[\d.,]*\s*\/\s*\d[\d.,]*\s*₺$/);
      if (match && match[1].toLocaleLowerCase('tr') !== 'ek sürücü') services.push({ button, name: match[1] });
    }
    if (!services.length) throw new Error('Aylık formda seçilebilir ek hizmet bulunamadı.');
    const chosen = services[Math.floor(Math.random() * services.length)];
    await chosen.button.click();
    return chosen.name;
  }

  async ensureBillingAddress() {
    const section = this.page.getByRole('heading', { name: 'Fatura Adresi Bilgileri', exact: true })
      .locator("xpath=ancestor::*[.//button and .//*[normalize-space(text())='Fatura Tipi']][1]");
    await expect(section).toBeVisible();
    const name = (await section.getByText('İsim', { exact: true }).first()
      .locator('xpath=following-sibling::*[1]').innerText()).trim();
    if (name && !['-', '—', '–'].includes(name)) return;
    await section.getByRole('button').first().click();
    await this.page.locator('button').filter({ hasText: 'ADRES' }).first().click();
    await this.page.locator('button').filter({ hasText: /^ADRES EKLE$/i }).first().click();
    await new BillingAddressModal(this.page).fill(this.env.monthly.customer);
  }

  async save() {
    const button = this.page.getByRole('button', { name: 'Rezervasyonları oluştur' });
    await expect(button).toBeEnabled();
    await button.click();
    await expect(this.page).toHaveURL(/\/reservation\/monthly-reservation-list/, { timeout: 30000 });
  }
}

export { addThirtyDayPeriods };
