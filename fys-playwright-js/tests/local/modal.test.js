import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { WashingModal } from '../../components/washing.modal.js';

test('Tekrarlanan Vuetify etiketi ve gecikmeli modal kapanışı', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <div class="v-dialog" role="dialog" id="modal">
        <div class="v-alert text-info" role="alert">Genel Merkez</div>
        <div class="v-input">
          <label for="km">Aracın KM</label><input id="km">
          <label for="km">Aracın KM</label>
        </div>
        <button onclick="setTimeout(() => document.querySelector('#modal').remove(), 250)">Kapat</button>
      </div>
    `);
    const modal = new WashingModal(page, { saveTimeout: 3000 });
    assert.equal(await modal.hasField('Aracın KM'), true);
    await modal.field('Aracın KM').fill('21410');
    assert.equal(await page.locator('#km').inputValue(), '21410');
    await modal.submit('Kapat');
    assert.equal(await page.locator('#modal').count(), 0);
  } finally { await browser.close(); }
});

test('Sonradan açılan alan beklenir; KM diğer alanlardan sonra doldurulur', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<div class="v-dialog" role="dialog" id="modal">
      <button onclick="document.querySelector('#modal').remove()">Kapat</button>
      </div><script>setTimeout(() => document.querySelector('#modal').insertAdjacentHTML('afterbegin',
        '<label for="km">Aracın KM</label><input id="km"><label for="fuel">Yakıt Miktarı</label><input id="fuel">'), 250)</script>`);
    const modal = new WashingModal(page, { actionTimeout: 3000, saveTimeout: 3000 });
    const calls = [];
    modal.description = async () => { calls.push('description'); };
    modal.vehicleCondition = async context => {
      calls.push('condition'); context.km = 100;
      await modal.field('Aracın KM').fill('100');
      await modal.field('Yakıt Miktarı').fill('4');
    };
    const context = { description: 'test', closed: false };
    await modal.fillCurrentStep(context);
    assert.deepEqual(calls, ['description', 'condition']);
    assert.equal(context.closed, true);
  } finally { await browser.close(); }
});
