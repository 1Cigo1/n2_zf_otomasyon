import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { ShortTermPage } from '../../pages/short-term.page.js';
import { FormControls } from '../../components/form.controls.js';

test('Ehliyet var/yok dalları ve mevcut fatura adresini koruma', async () => {
  const browser = await chromium.launch();
  try {
    for (const hasLicense of [false, true]) {
      const page = await browser.newPage();
      await page.route('https://example.test/**', async route => {
        if (route.request().url().includes('/check-driver/')) {
          await route.fulfill({ json: hasLicense ? { driving_license_no: '123', driving_license_date: '01.01.2020' } : {} });
        } else {
          await route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<main>
            <label for="customer">Müşteri</label><input id="customer">
            <div role="option" id="option">(12345678901) Otomasyon Kisa</div>
            <div class="v-field"><label for="driver">Sürücü</label><input id="driver"><span>Otomasyon Kisa</span></div>
            <section id="section5"><div><span>İsim</span><p>Otomasyon Kisa</p></div><p>12345678901</p></section>
            </main><script>
            document.querySelector('#option').onclick = () => fetch('/api/short-term-rental/check-driver/?customer=test-id').then(r=>r.json()).then(d=>{
              if(!d.driving_license_no) {
                document.body.insertAdjacentHTML('beforeend','<div class="v-dialog" role="dialog"><h2>Sürücü Ekle</h2></div>');
              } else {
                document.querySelector('#driver').value = 'driver-id';
              }
            });
            </script>` });
        }
      });
      await page.goto('https://example.test');
      const reservation = new ShortTermPage(page, { shortTerm: {} });
      let licenseCalls = 0, billingCalls = 0;
      reservation.customerDriver.licenseModal.fill = async () => {
        licenseCalls++;
        await page.locator('.v-dialog').evaluate(el => el.remove());
      };
      reservation.billing.modal.fill = async () => { billingCalls++; };
      const customer = { identity: '12345678901', firstName: 'Otomasyon' };
      await reservation.selectCustomerAndCheckLicense(customer);
      await reservation.ensureBillingAddress(customer);
      assert.equal(licenseCalls, hasLicense ? 0 : 1);
      assert.equal(billingCalls, 0);
      await page.close();
    }
  } finally { await browser.close(); }
});

test('Alan seçicisi iç içe v-input içindeki radio yerine etiketli inputu bulur', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<div class="v-input"><input type="radio">
      <div class="v-field"><label for="city">İl</label><label for="city">İl</label><input id="city"></div>
      </div>`);
    const form = new FormControls(page);
    await form.fill('İl', 'Ankara');
    assert.equal(await page.locator('#city').inputValue(), 'Ankara');
  } finally { await browser.close(); }
});
