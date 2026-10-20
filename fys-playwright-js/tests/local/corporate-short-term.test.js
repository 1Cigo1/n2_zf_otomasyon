import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { AdditionalServicesSection } from '../../components/reservations/additional-services.section.js';
import { CorporateShortTermPage } from '../../pages/corporate-short-term.page.js';
import {
  corporateReservationPeriod,
  maskIdentifier,
} from '../../support/corporate-short-term-data.js';

test('Kurumsal bitiş tarihi İstanbul takviminde ay ve yıl geçişini korur', () => {
  assert.deepEqual(
    corporateReservationPeriod(
      { durationDays: 40 },
      new Date('2026-12-30T22:30:00Z'),
    ),
    { end: '09.02.2027' },
  );
  assert.throws(() => corporateReservationPeriod({ durationDays: 0 }));
  assert.equal(maskIdentifier('KKD123456789'), '***6789');
});

test('Sözleşme satırı ilk satırdan değil sözleşme numarasından seçilir', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <label for="search">Herhangi bir şey arayın</label>
      <input id="search">
      <table><tbody>
        <tr id="wrong"><td>KKD-YANLIS</td></tr>
        <tr id="target"><td>KKD-HEDEF-123</td><td>
          <button><i class="mdi-chevron-right"></i></button>
        </td></tr>
      </tbody></table>
      <button id="create" hidden>Rezervasyon Yap</button>
      <script>
        document.querySelector('#target button').onclick = () => {
          document.querySelector('#target').dataset.selected = 'true';
          document.querySelector('#create').hidden = false;
        };
      </script>
    `);
    const corporate = new CorporateShortTermPage(page, {
      saveTimeout: 1000,
      corporateShortTerm: {},
    });
    await corporate.selectContract('KKD-HEDEF-123');
    assert.equal(await page.locator('#target').getAttribute('data-selected'), 'true');
    assert.equal(await page.locator('#wrong').getAttribute('data-selected'), null);
  } finally {
    await browser.close();
  }
});

test('Aylık özelleştirmede her ay hizmet seçilir ve Ek Sürücü dışlanır', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <button id="bulk" role="tab" aria-selected="true">Toplu İşlem</button>
      <button id="monthly" role="tab" aria-selected="false">Aylık Özelleştir</button>
      <section>
        <h2>Ek Hizmet ve Teklifler</h2>
        <div id="months" role="tablist" hidden>
          <button role="tab" data-month="oct" aria-selected="false">Ekim</button>
          <button role="tab" data-month="nov" aria-selected="false">Kasım</button>
        </div>
        <div data-panel="oct" hidden>
          <label><input id="oct-driver" type="checkbox">Ek Sürücü</label>
          <label><input id="oct-baby" type="checkbox">Bebek Koltuğu</label>
        </div>
        <div data-panel="nov" hidden>
          <label><input id="nov-driver" type="checkbox">Ek Sürücü</label>
          <label><input id="nov-scdw" type="checkbox">SCDW Hizmeti</label>
        </div>
      </section>
      <script>
        const showMonth = month => {
          document.querySelectorAll('[data-panel]').forEach(panel => {
            panel.hidden = panel.dataset.panel !== month;
          });
          document.querySelectorAll('[data-month]').forEach(tab => {
            tab.setAttribute('aria-selected', String(tab.dataset.month === month));
          });
        };
        document.querySelector('#monthly').onclick = () => {
          document.querySelector('#monthly').setAttribute('aria-selected', 'true');
          document.querySelector('#bulk').setAttribute('aria-selected', 'false');
          document.querySelector('#months').hidden = false;
          showMonth('oct');
        };
        document.querySelectorAll('[data-month]').forEach(tab => {
          tab.onclick = () => showMonth(tab.dataset.month);
        });
      </script>
    `);

    const selections = await new AdditionalServicesSection(page)
      .selectForPeriods();
    assert.deepEqual(selections, [
      { period: 'Ekim', service: 'Bebek Koltuğu' },
      { period: 'Kasım', service: 'SCDW Hizmeti' },
    ]);
    assert.equal(await page.locator('#oct-baby').isChecked(), true);
    assert.equal(await page.locator('#nov-scdw').isChecked(), true);
    assert.equal(await page.locator('#oct-driver').isChecked(), false);
    assert.equal(await page.locator('#nov-driver').isChecked(), false);
  } finally {
    await browser.close();
  }
});
