import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { AdditionalServicesSection } from '../../components/reservations/additional-services.section.js';
import { MonthlyPage } from '../../pages/monthly.page.js';

let browser;
test.before(async () => { browser = await chromium.launch({ headless: true }); });
test.after(async () => { await browser?.close(); });

async function withPage(html, run) {
  const page = await browser.newPage();
  try { await page.setContent(html); await run(page); }
  finally { await page.close(); }
}

test('Yalnız Ek Hizmetler bölümünün kutusu seçilir', async () => {
  await withPage(`<label><input type="checkbox" id="payment">Ödemeyi Sonra Al</label>
    <section><h2>Ek Hizmet ve Teklifler</h2>
      <label><input type="checkbox" id="baby">Bebek Koltuğu</label>
      <label><input type="checkbox" id="driver">Ek Sürücü</label>
      <label><input type="checkbox" id="winter" disabled>Kış Lastiği</label>
    </section>`, async page => {
    assert.equal(await new AdditionalServicesSection(page).selectOne(), 'Bebek Koltuğu');
    assert.equal(await page.locator('#baby').isChecked(), true);
    assert.equal(await page.locator('#driver').isChecked(), false);
    assert.equal(await page.locator('#payment').isChecked(), false);
  });
});

test('Seçilebilir ek hizmet yoksa açık hata verilir', async () => {
  await withPage(`<section><h2>Ek Hizmet ve Teklifler</h2>
    <label><input type="checkbox">Ek Sürücü</label>
    <label><input type="checkbox" disabled>Kış Lastiği</label></section>`, async page => {
    await assert.rejects(() => new AdditionalServicesSection(page).selectOne(), /seçilebilir ek hizmet bulunamadı/i);
  });
});

test('İki ayın her birinde Ek Sürücü dışı hizmet seçilir', async () => {
  await withPage(`<button id="bulk" role="tab" aria-selected="true">Toplu İşlem</button>
    <button id="monthly" role="tab" aria-selected="false">Aylık Özelleştir</button>
    <section><h2>Ek Hizmet ve Teklifler</h2>
      <div id="month-tabs" role="tablist" hidden>
        <button role="tab" data-month="october" aria-selected="false">Ekim</button>
        <button role="tab" data-month="november" aria-selected="false">Kasım</button>
      </div>
      <div data-panel="october" hidden>
        <label><input id="october-driver" type="checkbox">Ek Sürücü</label>
        <label><input id="october-baby" type="checkbox">Bebek Koltuğu</label>
      </div>
      <div data-panel="november" hidden>
        <label><input id="november-driver" type="checkbox">Ek Sürücü</label>
        <label><input id="november-scdw" type="checkbox">SCDW Hizmeti</label>
      </div>
    </section>
    <script>
      const bulk = document.querySelector('#bulk');
      const monthly = document.querySelector('#monthly');
      const tabs = document.querySelector('#month-tabs');
      function showMonth(month) {
        document.querySelectorAll('[data-panel]').forEach(p => p.hidden = p.dataset.panel !== month);
        document.querySelectorAll('[data-month]').forEach(t =>
          t.setAttribute('aria-selected', String(t.dataset.month === month)));
      }
      monthly.addEventListener('click', () => {
        monthly.setAttribute('aria-selected', 'true');
        bulk.setAttribute('aria-selected', 'false');
        tabs.hidden = false;
        showMonth('october');
      });
      document.querySelectorAll('[data-month]').forEach(t =>
        t.addEventListener('click', () => showMonth(t.dataset.month)));
    </script>`, async page => {
    assert.deepEqual(await new AdditionalServicesSection(page).selectForPeriods(), [
      { period: 'Ekim', service: 'Bebek Koltuğu' },
      { period: 'Kasım', service: 'SCDW Hizmeti' },
    ]);
    assert.equal(await page.locator('#october-baby').isChecked(), true);
    assert.equal(await page.locator('#november-scdw').isChecked(), true);
    assert.equal(await page.locator('#october-driver').isChecked(), false);
    assert.equal(await page.locator('#november-driver').isChecked(), false);
  });
});

test('Aylık hizmet seçimi Ek Sürücü düğmesini atlar', async () => {
  await withPage(`<h2>Ek hizmetler ve özel fiyat</h2>
    <button>Tüm rezervasyonlar</button>
    <button id="driver">Ek Sürücü 2 / 2 ₺</button>
    <button id="baby" onclick="this.setAttribute('aria-pressed','true')">Bebek Koltuğu 5 / 5 ₺</button>`, async page => {
    const monthly = new MonthlyPage(page, { monthly: {} });
    assert.equal(await monthly.chooseAdditionalService(), 'Bebek Koltuğu');
    assert.equal(await page.locator('#baby').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#driver').getAttribute('aria-pressed'), null);
  });
});
