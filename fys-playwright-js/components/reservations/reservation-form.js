import { expect } from '@playwright/test';
import { exactText, FormControls } from '../form.controls.js';

const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

export class ReservationForm {
  constructor(page, { saveTimeout = 30000 } = {}) {
    this.page = page;
    this.saveTimeout = saveTimeout;
    this.form = new FormControls(page, page.locator('main'));
  }

  async fillDates(dates) {
    for (const [placeholder, value] of [
      ['Rezervasyon Başlangıç Tarihi', dates.start],
      ['Rezervasyon Bitiş Tarihi', dates.end],
      ['Rezervasyon Başlangıç Saati', dates.time],
      ['Rezervasyon Bitiş Saati', dates.time],
    ]) {
      const input = this.page.getByPlaceholder(placeholder, { exact: true });
      await input.fill(value);
      await input.press('Tab');
      await expect(input).toHaveValue(value);
    }
  }

  async fillEndDate(endDate) {
    const input = this.page.getByPlaceholder(
      'Rezervasyon Bitiş Tarihi',
      { exact: true },
    );
    const [day, month, year] = endDate.split('.').map(Number);
    await input.click();

    const calendar = this.page
      .locator('.p-datepicker-panel:visible, .p-datepicker:visible').last();
    await expect(calendar).toBeVisible();

    for (let attempt = 0; attempt < 24; attempt += 1) {
      const visibleMonth = (await calendar.getByRole('button', {
        name: 'Ay Seçiniz', exact: true,
      }).innerText()).trim();
      const visibleYear = Number((await calendar.getByRole('button', {
        name: 'Yıl Seçiniz', exact: true,
      }).innerText()).trim());
      const difference = (year - visibleYear) * 12 +
        (month - 1 - MONTHS.indexOf(visibleMonth));
      if (difference === 0) break;
      await calendar.getByRole('button', {
        name: difference > 0 ? 'Gelecek Ay' : 'Geçen Ay', exact: true,
      }).click();
    }

    const targetDay = calendar
      .locator('td:not(.p-datepicker-other-month) [data-pc-section="day"]')
      .filter({ hasText: exactText(String(day)) });
    await expect(targetDay, `${endDate} takvimde seçilebilir olmalı`).toHaveCount(1);
    await expect(targetDay).toHaveAttribute('aria-disabled', 'false');
    await targetDay.click();
    await expect(input).toHaveValue(endDate);
  }

  async selectOfficeAndGroup() {
    await this.form.fillAndChoose(
      'Teslim Alma Ofisi',
      'Ankara Çankaya (Next Level AVM)',
    );
    await this.form.fillAndChoose('Araç Grubu', 'CDAD');
  }

  async save() {
    const [response] = await Promise.all([
      this.page.waitForResponse(response =>
        new URL(response.url()).pathname.endsWith('/short-term-rental/') &&
        response.request().method() === 'POST',
      { timeout: this.saveTimeout }),
      this.page.getByRole('button', { name: /^Kaydet$/i }).click(),
    ]);

    expect(
      [200, 201],
      `Kısa dönem rezervasyon kaydı HTTP ${response.status()}`,
    ).toContain(response.status());
    const body = await response.json();
    const record = body.data || body.reservationData || body;
    const id = record.id || body.id;
    const code = record.reservation_code || body.reservation_code;
    expect(typeof id).toBe('string');
    expect(Boolean(code)).toBe(true);

    const requestHeaders = await response.request().allHeaders();
    return {
      id,
      code,
      collectionPath: new URL(response.url()).pathname,
      requestHeaders,
    };
  }
}
