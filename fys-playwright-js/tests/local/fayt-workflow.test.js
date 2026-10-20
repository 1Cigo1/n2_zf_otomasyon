import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import {
  FaytModal, newWorkflowContext, fuelVehiclePattern,
} from '../../components/fayt-workflow.modal.js';
import { FaytPage } from '../../pages/fayt-workflow.page.js';

let browser;
test.before(async () => { browser = await chromium.launch({ headless: true }); });
test.after(async () => { await browser?.close(); });

async function withPage(html, run) {
  const page = await browser.newPage();
  try { await page.setContent(html); await run(page); }
  finally { await page.close(); }
}

test('Yakıt için seçilen araçta sayısal seviye bulunmalı', () => {
  assert.match('06TST201 - HYUNDAI İ20 (2 / Benzin)', fuelVehiclePattern);
  assert.equal(fuelVehiclePattern.test('67LSA678 - TOFAS-FIAT PRATICO (None / Dizel)'), false);
});

test('Yıkama ve yakıt talebi sabit plaka tercihi yapmaz', async () => {
  await withPage('<div></div>', async page => {
    const modal = new FaytModal(page);
    const calls = [];
    modal.photoRequest = async (...args) => { calls.push(args); return false; };
    await modal.washingRequest(newWorkflowContext('standart_yikama'));
    await modal.fuelRequest(newWorkflowContext('kiralama_donusu_yakit_alma'));
    assert.equal(calls[0][3], undefined);
    assert.equal(calls[1][3].requiredPattern, fuelVehiclePattern);
    assert.equal(calls[1][3].preferredPattern, undefined);
  });
});

test('Aktif talebi olan araç bırakılır ve seçilen dosya temizlenir', async () => {
  await withPage(`<div class="v-dialog v-overlay--active" role="dialog">
    <label for="vehicle">Araç</label><input id="vehicle" value="06TST202 - FIAT EGEA (4 / Dizel)">
    <input id="photos" type="file" multiple><button>Kaydet</button></div>
    <div role="alert">Bu araç için aynı iş akışında aktif bir talep bulunmaktadır.</div>`, async page => {
    await page.locator('#photos').setInputFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('photo') });
    const context = newWorkflowContext('kiralama_donusu_yakit_alma');
    context.selectedVehicle = '06TST202 - FIAT EGEA (4 / Dizel)';
    context.selectedPlate = '06TST202';
    context.values = { fuel_level: '4', fuel_request_photos: 'true' };
    context.attemptedVehicles.add(context.selectedVehicle);
    const changed = await new FaytModal(page).prepareAnotherVehicle(context, new Error('aktif talep bulundu'));
    assert.equal(changed, true);
    assert.equal(context.selectedVehicle, null);
    assert.equal(context.selectedPlate, null);
    assert.deepEqual(context.values, {});
    assert.equal(await page.locator('#photos').evaluate(input => input.files.length), 0);
    assert.equal(context.attemptedVehicles.size, 1);
  });
});

test('İlk yakıt kaydı açıklamasız takılırsa farklı araç denenir', async () => {
  await withPage(`<div class="v-dialog v-overlay--active" role="dialog">
    <label for="vehicle">Araç</label><input id="vehicle">
    <input id="photos" type="file" multiple><button>Kaydet</button></div>`, async page => {
    const context = newWorkflowContext('kiralama_donusu_yakit_alma');
    context.selectedVehicle = '67LSA334 - CHERY KİMO (2 / Elektrikli)';
    context.selectedPlate = '67LSA334';
    context.values = { fuel_level: '4', fuel_request_photos: 'true' };
    const changed = await new FaytModal(page).prepareAnotherVehicle(
      context, new Error('Kaydet tıklandı fakat modal kapanmadı.'),
    );
    assert.equal(changed, true);
    assert.equal(context.selectedVehicle, null);
    assert.deepEqual(context.values, {});
  });
});

test('Aktif talep uyarısı kaydetme bekleyişini hemen durdurur', async () => {
  await withPage(`<div class="v-dialog v-overlay--active" role="dialog">
    <label for="vehicle">Araç</label><input id="vehicle"><button>Kaydet</button></div>
    <div role="alert">Bu araç için aynı iş akışında aktif bir talep bulunmaktadır.</div>`, async page => {
    const modal = new FaytModal(page);
    const dialog = await modal.dialog.elementHandle();
    await assert.rejects(() => modal.waitUntilSaved(dialog, 5000), /aktif talep bulundu/i);
  });
});

test('Geçici bildirim kaydı başarılı saymaz; modal kapanmasını bekler', async () => {
  await withPage(`<div class="v-dialog v-overlay--active" role="dialog" id="modal">
      <p>Talep oluştur</p><button onclick="save()">Kaydet</button></div>
    <div role="alert" id="notice"></div>
    <script>
      window.saveCount = 0;
      function save() {
        window.saveCount++;
        document.querySelector('#notice').textContent = 'Plakaya Ait Sözleşme Bulunamamıştır';
        setTimeout(() => document.querySelector('#notice').textContent = '', 150);
        setTimeout(() => document.querySelector('#modal').remove(), 600);
      }
    </script>`, async page => {
    const context = newWorkflowContext('standart_yikama');
    context.selectedPlate = '06TEST1';
    await new FaytPage(page, { baseURL: 'https://example.test' })
      .processModal(new FaytModal(page), context);
    assert.equal(await page.locator('#modal').count(), 0);
    assert.equal(await page.evaluate(() => window.saveCount), 1);
    assert.equal(context.selectedPlate, '06TEST1');
  });
});

test('Kaydetme süresi dolunca işlem başarı gibi ilerlemez', async () => {
  await withPage(`<div class="v-dialog v-overlay--active" role="dialog">Kaydet</div>
    <div role="alert" id="notice">Plakaya Ait Sözleşme Bulunamamıştır</div>`, async page => {
    const modal = new FaytModal(page);
    const dialog = await modal.dialog.elementHandle();
    await page.evaluate(() => setTimeout(() => document.querySelector('#notice').remove(), 150));
    await assert.rejects(() => modal.waitUntilSaved(dialog, 500), /Plaka aramasına geçilmedi/);
    assert.equal(await modal.isOpen(), true);
  });
});

test('Yıkama ilerletmede KM, yakıt ve altı fotoğraf kaydedilir', async () => {
  const inputs = Array.from({ length: 6 }, (_, i) => `<input type="file" id="photo${i}" required>`).join('');
  await withPage(`<div class="v-dialog v-overlay--active" role="dialog" id="modal">
      <h2>Kilometre</h2><span>21400</span>
      <label for="km">Aracın KM</label><input id="km">
      <label for="fuel">Yakıt Miktarı</label><input id="fuel">
      <div class="ql-editor" contenteditable="true"></div>${inputs}
      <button onclick="window.submitted={km:document.querySelector('#km').value,
        fuel:document.querySelector('#fuel').value,
        photos:Array.from(document.querySelectorAll('input[type=file]')).map(i=>i.files.length)};
        document.querySelector('#modal').remove()">İlerlet</button></div>`, async page => {
    const context = newWorkflowContext('standart_yikama');
    context.selectedPlate = '06TST201';
    await new FaytPage(page, { baseURL: 'https://example.test' })
      .processModal(new FaytModal(page), context);
    const submitted = await page.evaluate(() => window.submitted);
    assert.ok(Number(submitted.km) >= 21400);
    assert.equal(submitted.fuel, '4');
    assert.deepEqual(submitted.photos, [1, 1, 1, 1, 1, 1]);
    assert.equal(context.values.washing_advance_filled, 'true');
  });
});

test('Yakıt ilerletmede etiketsiz KM ve yakıt alanları bulunur', async () => {
  const inputs = Array.from({ length: 6 }, (_, i) => `<input type="file" id="photo${i}" required>`).join('');
  await withPage(`<div class="v-dialog v-overlay--active" role="dialog" id="modal">
      <h2>Kilometre</h2><span>18500</span>
      <input class="v-field__input" id="km" value="18500">
      <input class="v-field__input" id="fuel" value="8">${inputs}
      <button onclick="window.submitted={km:document.querySelector('#km').value,
        fuel:document.querySelector('#fuel').value,
        photos:Array.from(document.querySelectorAll('input[type=file]')).map(i=>i.files.length)};
        document.querySelector('#modal').remove()">İlerlet</button></div>`, async page => {
    const context = newWorkflowContext('kiralama_donusu_yakit_alma');
    context.selectedPlate = '06TST101';
    await new FaytPage(page, { baseURL: 'https://example.test' })
      .processModal(new FaytModal(page), context);
    const submitted = await page.evaluate(() => window.submitted);
    assert.ok(Number(submitted.km) > 18500);
    assert.equal(submitted.fuel, '4');
    assert.deepEqual(submitted.photos, [1, 1, 1, 1, 1, 1]);
    assert.equal(context.values.fuel_advance_filled, 'true');
  });
});
