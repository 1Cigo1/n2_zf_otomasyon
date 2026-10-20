import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { MonthlyPage, addThirtyDayPeriods } from '../../pages/monthly.page.js';

test('Aylık rezervasyon iki 30 günlük dönem ekler', () => {
  assert.equal(addThirtyDayPeriods('05.10.2026', 2), '04.12.2026');
});

test('Yapılandırılan üç dönem bitiş tarihini değiştirir', () => {
  assert.equal(addThirtyDayPeriods('05.10.2026', 3), '03.01.2027');
});

test('Aylık sayfa yapılandırılmış dönem sayısını kullanır', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<input placeholder="Başlangıç tarihi" value="05.10.2026">
      <input placeholder="Bitiş tarihi"><input placeholder="Başlangıç saati" value="09:15">
      <input placeholder="Bitiş saati">`);
    await new MonthlyPage(page, { monthly: { periodCount: 3 } }).chooseDates();
    assert.equal(await page.getByPlaceholder('Bitiş tarihi').inputValue(), '03.01.2027');
    assert.equal(await page.getByPlaceholder('Bitiş saati').inputValue(), '09:15');
  } finally {
    await browser.close();
  }
});

test('Aylık rezervasyonda boş tarih ve sıfır dönem reddedilir', () => {
  assert.throws(() => addThirtyDayPeriods('', 2), /geçersiz/i);
  assert.throws(() => addThirtyDayPeriods('05.10.2026', 0), /geçersiz/i);
});
