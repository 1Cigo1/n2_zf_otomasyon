import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { FaytModal, newWorkflowContext } from '../../components/fayt-workflow.modal.js';
import { FaytPage } from '../../pages/fayt-workflow.page.js';

let browser;
test.before(async () => { browser = await chromium.launch({ headless: true }); });
test.after(async () => { await browser?.close(); });

async function withPage(html, run) {
  const page = await browser.newPage();
  try { await page.setContent(html); await run(page); }
  finally { await page.close(); }
}

async function process(page, context, modal = new FaytModal(page)) {
  return new FaytPage(page, { baseURL: 'https://example.test' }).processModal(modal, context);
}

const photos = (prefix = 'photo') => Array.from({ length: 6 }, (_, i) =>
  `<input type="file" id="${prefix}-${i}" required>`).join('');

test('Aktif yıkama talebinde eski araç ve fotoğraf seçimi temizlenir', async () => {
  await withPage(`<div class="v-dialog v-overlay--active" role="dialog">
    <label for="vehicle">Araç</label><input id="vehicle">
    <input id="photo" type="file"><button>Kaydet</button></div>
    <div role="alert">Bu araç için aynı iş akışında aktif bir talep bulunmaktadır.</div>`, async page => {
    await page.locator('#photo').setInputFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('photo') });
    const context = newWorkflowContext('standart_yikama');
    context.selectedVehicle = '06TST202 - FIAT EGEA (4 / Dizel)';
    context.selectedPlate = '06TST202';
    context.values.washing_request_photos = 'true';
    context.attemptedVehicles.add(context.selectedVehicle);
    const changed = await new FaytModal(page).prepareAnotherVehicle(context, new Error('aktif talep bulundu'));
    assert.equal(changed, true);
    assert.equal(context.selectedVehicle, null);
    assert.equal(context.selectedPlate, null);
    assert.equal(context.values.washing_request_photos, undefined);
    assert.equal(await page.locator('#photo').evaluate(input => input.files.length), 0);
    assert.equal(context.attemptedVehicles.size, 1);
  });
});

test('Sistem mesajı yalnız bir kez yazdırılır', async () => {
  await withPage('<div role="alert">Kayıt başarıyla oluşturuldu.</div>', async page => {
    const modal = new FaytModal(page);
    const output = [];
    const oldLog = console.log;
    console.log = (...args) => output.push(args.join(' '));
    try {
      await modal.validationMessages();
      await modal.validationMessages();
    } finally { console.log = oldLog; }
    assert.equal(output.filter(line => line.includes('[SİSTEM MESAJI] Kayıt başarıyla oluşturuldu.')).length, 1);
  });
});

test('Bildirim yoksa zaman aşımı başarı sayılmaz ve araç korunur', async () => {
  await withPage(`<div class="v-dialog v-overlay--active" role="dialog" id="modal">Kaydet</div>
    <div role="alert"></div>`, async page => {
    const modal = new FaytModal(page);
    const dialog = await modal.dialog.elementHandle();
    await assert.rejects(() => modal.waitUntilSaved(dialog, 350), error =>
      error.message.includes('Plaka aramasına geçilmedi')
      && error.message.includes('mesaj bulunamadı'));
    assert.equal(await modal.isOpen(), true);
  });
});

test('Bilgi uyarısı hata sayılmaz; gerçek hata uyarısı gösterilir', async () => {
  await withPage(`<div role="alert" class="v-alert text-info">Genel Merkez</div>
    <div role="alert" class="v-alert text-error">Kilometre geçersiz</div>`, async page => {
    const modal = new FaytModal(page);
    assert.equal(await modal.validationMessages(), 'Kilometre geçersiz');
  });
});

test('Elektrikli araç yıkamasında fotoğraf yokken yakıt değeri klavyeyle girilir', async () => {
  await withPage(`<div class="v-dialog v-overlay--active" role="dialog" id="modal">
    <h2>Kilometre</h2><span>80112</span>
    <span>Yakıt Tipi</span><span>Elektrikli</span>
    <label for="km">Aracın KM</label><input id="km" value="80112">
    <label for="fuel">Yakıt Miktarı</label>
    <input id="fuel" onkeydown="this.dataset.typed='true'" oninput="if (!this.dataset.typed) this.value=''">
    <div class="ql-editor" contenteditable="true"></div>
    <button onclick="window.submitted={km:document.querySelector('#km').value,
      fuel:document.querySelector('#fuel').value}; document.querySelector('#modal').remove()">İlerlet</button>
    </div>`, async page => {
    const context = newWorkflowContext('standart_yikama');
    context.selectedPlate = '34SLA120';
    context.finalKm = 80112;
    await process(page, context);
    const submitted = await page.evaluate(() => window.submitted);
    assert.equal(Number(submitted.km), 80112);
    assert.equal(submitted.fuel, '4');
    assert.equal(context.values.washing_advance_filled, 'true');
    assert.equal(context.requestClosed, false);
  });
});

test('Yıkama kapatırken gereksiz dosya alanı boş kalır', async () => {
  await withPage(`<div class="v-dialog v-overlay--active" role="dialog" id="modal">
    <h1>Araç Talebini Kapat</h1><h2>Kilometre</h2><span>82243</span>
    <label for="km">Aracın KM</label><input id="km">
    <label for="fuel">Yakıt Miktarı</label><input id="fuel">
    <input id="incidental" type="file"><div class="ql-editor" contenteditable="true"></div>
    <button onclick="window.submitted={km:document.querySelector('#km').value,
      fuel:document.querySelector('#fuel').value,
      incidental:document.querySelector('#incidental').files.length};
      document.querySelector('#modal').remove()">Kapat</button></div>`, async page => {
    const context = newWorkflowContext('standart_yikama');
    context.finalKm = 82243;
    await process(page, context);
    const submitted = await page.evaluate(() => window.submitted);
    assert.ok(Number(submitted.km) > 82243);
    assert.equal(submitted.fuel, '4');
    assert.equal(submitted.incidental, 0);
    assert.equal(context.values.washing_close_filled, 'true');
    assert.equal(context.requestClosed, true);
  });
});

test('Yıkama kapanışında altı zorunlu fotoğraf yüklenir', async () => {
  await withPage(`<div class="v-dialog v-overlay--active" role="dialog" id="modal">
    <h1>Araç Talebini Kapat</h1><h2>Kilometre</h2><span>18613</span>
    <label for="km">Aracın KM</label><input id="km">
    <label for="fuel">Yakıt Miktarı</label><input id="fuel">${photos()}
    <div class="ql-editor" contenteditable="true"></div>
    <button onclick="window.submitted={km:document.querySelector('#km').value,
      fuel:document.querySelector('#fuel').value,
      photos:Array.from(document.querySelectorAll('input[type=file]')).map(i=>i.files.length)};
      document.querySelector('#modal').remove()">Kapat</button></div>`, async page => {
    const context = newWorkflowContext('standart_yikama');
    context.finalKm = 18613;
    await process(page, context);
    const submitted = await page.evaluate(() => window.submitted);
    assert.ok(Number(submitted.km) > 18613);
    assert.equal(submitted.fuel, '4');
    assert.deepEqual(submitted.photos, [1, 1, 1, 1, 1, 1]);
    assert.equal(context.requestClosed, true);
  });
});

test('Yıkama kapanışında sonradan açılan alanlar ve fotoğraflar beklenir', async () => {
  await withPage(`<div class="v-dialog v-overlay--active" role="dialog" id="modal">
    <h1>Araç Talebini Kapat</h1><div id="dynamic"></div>
    <button onclick="window.submitted={km:document.querySelector('#km').value,
      fuel:document.querySelector('#fuel').value,
      photos:Array.from(document.querySelectorAll('input[type=file]')).map(i=>i.files.length)};
      document.querySelector('#modal').remove()">Kapat</button></div>
    <script>setTimeout(() => { document.querySelector('#dynamic').innerHTML =
      '<h2>Kilometre</h2><span>9859</span>' +
      '<label for="km">Aracın KM</label><input id="km" value="9859">' +
      '<label for="fuel">Yakıt Miktarı</label><input id="fuel">' +
      '${photos('delayed')}' + '<div class="ql-editor" contenteditable="true"></div>';
    }, 150)</script>`, async page => {
    const context = newWorkflowContext('standart_yikama');
    await process(page, context);
    const submitted = await page.evaluate(() => window.submitted);
    assert.ok(Number(submitted.km) >= 9859);
    assert.equal(submitted.fuel, '4');
    assert.deepEqual(submitted.photos, [1, 1, 1, 1, 1, 1]);
    assert.equal(context.requestClosed, true);
  });
});

test('Tek çoklu fotoğraf alanına altı dosya yüklenir', async () => {
  await withPage(`<div class="v-dialog v-overlay--active" role="dialog" id="modal">
    <h1>Araç Talebini Kapat</h1><h2>Kilometre</h2><span>82243</span>
    <label for="km">Aracın KM</label><input id="km">
    <label for="fuel">Yakıt Miktarı</label><input id="fuel">
    <input id="multi" type="file" multiple><div class="ql-editor" contenteditable="true"></div>
    <button onclick="window.submitted={km:document.querySelector('#km').value,
      fuel:document.querySelector('#fuel').value,
      photos:document.querySelector('#multi').files.length};
      document.querySelector('#modal').remove()">Kapat</button></div>`, async page => {
    const context = newWorkflowContext('standart_yikama');
    context.finalKm = 82243;
    await process(page, context);
    const submitted = await page.evaluate(() => window.submitted);
    assert.ok(Number(submitted.km) > 82243);
    assert.equal(submitted.fuel, '4');
    assert.equal(submitted.photos, 6);
    assert.equal(context.requestClosed, true);
  });
});

test('Yakıt alma talebinde fotoğraflar ve yakıt seviyesi kaydedilir', async () => {
  await withPage(`<div class="v-dialog v-overlay--active" role="dialog" id="modal">
    <label for="vehicle">Araç</label><input id="vehicle" value="06TST201">
    <label for="fuel">Yakıt Seviyesi (1-8)</label><input id="fuel" type="number">
    <input id="multi" type="file" multiple hidden
      onchange="document.querySelector('#fuel').value=''">
    <button aria-label="Araç Fotoğrafları">Araç Fotoğrafları</button>
    <div class="ql-editor" contenteditable="true"></div>
    <button onclick="window.submitted={photos:document.querySelector('#multi').files.length,
      fuel:document.querySelector('#fuel').value}; document.querySelector('#modal').remove()">Kaydet</button>
    </div>`, async page => {
    const context = newWorkflowContext('kiralama_donusu_yakit_alma');
    context.selectedVehicle = '06TST201 - HYUNDAI İ20 (2 / Benzin)';
    context.selectedPlate = '06TST201';
    await process(page, context);
    const submitted = await page.evaluate(() => window.submitted);
    assert.equal(submitted.photos, 6);
    assert.equal(submitted.fuel, '4');
    assert.equal(context.values.fuel_request_photos, 'true');
    assert.equal(context.values.fuel_level, '4');
    assert.equal(context.values.washing_request_photos, undefined);
  });
});

test('Yeniden açılan yakıt ilerletmede yeni fotoğraf alanları doldurulur', async () => {
  await withPage(`<div class="v-dialog v-overlay--active" role="dialog" id="modal">
    <h2>Kilometre</h2><span>18600</span>
    <input class="v-field__input" id="km" value="18600">
    <input class="v-field__input" id="fuel" value="8">${photos('reopen')}
    <div class="ql-editor" contenteditable="true"></div>
    <button onclick="window.submitted={km:document.querySelector('#km').value,
      fuel:document.querySelector('#fuel').value,
      photos:Array.from(document.querySelectorAll('input[type=file]')).map(i=>i.files.length)};
      document.querySelector('#modal').remove()">İlerlet</button></div>`, async page => {
    const context = newWorkflowContext('kiralama_donusu_yakit_alma');
    context.finalKm = 18550;
    context.values.fuel_advance_filled = 'true';
    await process(page, context);
    const submitted = await page.evaluate(() => window.submitted);
    assert.ok(Number(submitted.km) > 18600);
    assert.equal(submitted.fuel, '4');
    assert.deepEqual(submitted.photos, [1, 1, 1, 1, 1, 1]);
  });
});

test('Etiketli yakıt alanları olsa da zorunlu fotoğraflar yüklenir', async () => {
  await withPage(`<div class="v-dialog v-overlay--active" role="dialog" id="modal">
    <h2>Kilometre</h2><span>4200</span>
    <input aria-label="Aracın KM" id="km" value="4200">
    <input aria-label="Yakıt Miktarı" id="fuel" value="4">${photos('labeled')}
    <button onclick="window.submitted={km:document.querySelector('#km').value,
      fuel:document.querySelector('#fuel').value,
      photos:Array.from(document.querySelectorAll('input[type=file]')).map(i=>i.files.length)};
      document.querySelector('#modal').remove()">İlerlet</button></div>`, async page => {
    const context = newWorkflowContext('kiralama_donusu_yakit_alma');
    await process(page, context);
    const submitted = await page.evaluate(() => window.submitted);
    assert.ok(Number(submitted.km) > 4200);
    assert.equal(submitted.fuel, '4');
    assert.deepEqual(submitted.photos, [1, 1, 1, 1, 1, 1]);
  });
});

test('Yakıt kapanışında KM güncellenir ve yakıt 4 olur', async () => {
  await withPage(`<div class="v-dialog v-overlay--active" role="dialog" id="modal">
    <h2>Kilometre</h2><span>23553</span>
    <label for="km">Aracın KM</label><input id="km">
    <label for="fuel">Yakıt Miktarı</label><input id="fuel">
    <button onclick="window.submitted={km:document.querySelector('#km').value,
      fuel:document.querySelector('#fuel').value}; document.querySelector('#modal').remove()">Kapat</button>
    </div>`, async page => {
    const context = newWorkflowContext('kiralama_donusu_yakit_alma');
    context.finalKm = 23553;
    await process(page, context);
    const submitted = await page.evaluate(() => window.submitted);
    assert.ok(Number(submitted.km) > 23553);
    assert.equal(submitted.fuel, '4');
    assert.equal(context.values.fuel_close_filled, 'true');
    assert.equal(context.requestClosed, true);
  });
});

test('Sonradan açılan yakıt alanı doldurulmadan ilerlenmez', async () => {
  await withPage(`<div class="v-dialog v-overlay--active" role="dialog" id="modal">
    <h2>Kilometre</h2><span>12000</span>
    <label for="km">Aracın KM</label><input id="km" value="12000">
    <div id="fuel-slot"></div>${photos('delayed-fuel')}
    <button onclick="window.submitted=document.querySelector('#fuel').value;
      document.querySelector('#modal').remove()">İlerlet</button></div>
    <script>setTimeout(() => { document.querySelector('#fuel-slot').innerHTML =
      '<label for="fuel">Yakıt Miktarı</label><input id="fuel">'; }, 150)</script>`, async page => {
    const context = newWorkflowContext('kiralama_donusu_yakit_alma');
    await process(page, context);
    assert.equal(await page.evaluate(() => window.submitted), '4');
    assert.equal(context.values.fuel_advance_filled, 'true');
  });
});

test('Son yakıt modalında teslim kişisi yeniden seçilir ve sayılar doldurulur', async () => {
  await withPage(`<div class="v-dialog v-overlay--active" role="dialog" id="modal">
    <h2>Kilometre</h2><span>22000</span>
    <label for="delivery">Teslim Yapacak Kişi</label><input id="delivery">
    <label for="km">Aracın KM</label><input id="km">
    <label for="fuel">Yakıt Miktarı</label><input id="fuel" value="0">
    <button onclick="window.submitted={delivery:document.querySelector('#delivery').value,
      km:document.querySelector('#km').value, fuel:document.querySelector('#fuel').value};
      document.querySelector('#modal').remove()">Kapat</button></div>`, async page => {
    const context = newWorkflowContext('kiralama_donusu_yakit_alma');
    context.values.delivery_person = 'Önceki modalın kişisi';
    const modal = new FaytModal(page);
    modal.chooseOption = async field => { await field.fill('Yeni Teslim Kişisi'); return 'Yeni Teslim Kişisi'; };
    await process(page, context, modal);
    const submitted = await page.evaluate(() => window.submitted);
    assert.equal(submitted.delivery, 'Yeni Teslim Kişisi');
    assert.ok(Number(submitted.km) > 22000);
    assert.equal(submitted.fuel, '4');
    assert.equal(context.requestClosed, true);
  });
});

test('Onayla yüklenirken ikinci kez tıklanmaz; modal kapanışı beklenir', async () => {
  await withPage(`<div class="v-dialog v-overlay--active" role="dialog" id="modal">
    <button id="approve" onclick="window.clicks=(window.clicks||0)+1;
      this.classList.add('v-btn--loading'); this.setAttribute('aria-busy','true');
      this.textContent=''; setTimeout(()=>document.querySelector('#modal').remove(),300)">Onayla</button>
    </div>`, async page => {
    await new FaytModal(page).clickAction('Onayla');
    assert.equal(await page.evaluate(() => window.clicks), 1);
    assert.equal(await page.locator('#modal').count(), 0);
  });
});

test('Yakıt onay özetindeki aria Kapat butonu kapanış sayılmaz', async () => {
  await withPage(`<div class="v-dialog v-overlay--active" role="dialog" id="modal">
    <button aria-label="Kapat"><span>Kapat</span></button>
    <label for="historical">Aracın KM</label><input id="historical" value="1450020" readonly>
    <button onclick="document.querySelector('#modal').remove()">Onayla</button></div>`, async page => {
    const modal = new FaytModal(page);
    modal.waitForDynamicFuelStep = async () => false;
    assert.equal(await modal.hasButton('Kapat'), false);
    const context = newWorkflowContext('kiralama_donusu_yakit_alma');
    await process(page, context, modal);
    assert.equal(await page.locator('#modal').count(), 0);
  });
});

test('Yakıt alanı beklerken dinamik Onayla görünürse bekleme biter', async () => {
  await withPage(`<div class="v-dialog v-overlay--active" role="dialog" id="modal">
    <label for="historical">Aracın KM</label><input id="historical" value="1450020" readonly>
    <button id="action">Kapat</button></div>
    <script>setTimeout(()=>document.querySelector('#action').textContent='Onayla',150)</script>`, async page => {
    const fields = await new FaytModal(page).waitForConditionFields(2000);
    assert.equal(fields, null);
  });
});

test('Geçici Onayla ekranından gerçek yakıt adımına geçiş beklenir', async () => {
  await withPage(`<div class="v-dialog v-overlay--active" role="dialog" id="modal">
    <button id="action">Onayla</button></div>
    <script>setTimeout(() => { document.querySelector('#action').textContent='İlerlet';
      for (let i=0;i<6;i++) { const input=document.createElement('input'); input.type='file';
        document.querySelector('#modal').appendChild(input); } },100)</script>`, async page => {
    const modal = new FaytModal(page);
    assert.equal(await modal.waitForDynamicFuelStep(1000), true);
    assert.equal(await modal.hasButton('İlerlet'), true);
  });
});

test('Kapat butonu modal kapanmadan talebi bitmiş saymaz', async () => {
  await withPage(`<div class="v-dialog v-overlay--active" role="dialog" id="modal">
    <p id="status">Talep</p><button onclick="document.querySelector('#status').textContent='Kapatılıyor';
      setTimeout(()=>document.querySelector('#modal').remove(),400)">Kapat</button></div>`, async page => {
    const context = newWorkflowContext('standart_yikama');
    await process(page, context);
    assert.equal(context.requestClosed, true);
    assert.equal(await page.locator('#modal').count(), 0);
  });
});

test('Kapanan talep için plaka bir daha aranmaz ve ilerletilmez', async () => {
  const page = {};
  const fayt = new FaytPage(page, { baseURL: 'https://example.test' });
  let advanced = 0;
  let processed = 0;
  fayt.openWorkflow = async () => {};
  fayt.startRequest = async () => ({});
  fayt.advanceRequest = async plate => { assert.equal(plate, '06TST201'); advanced++; return true; };
  fayt.processModal = async (_modal, context) => {
    processed++;
    if (processed === 1) context.selectedPlate = '06TST201';
    else context.requestClosed = true;
    return context;
  };
  const context = await fayt.run('standart_yikama');
  assert.equal(context.requestClosed, true);
  assert.equal(advanced, 1);
});
