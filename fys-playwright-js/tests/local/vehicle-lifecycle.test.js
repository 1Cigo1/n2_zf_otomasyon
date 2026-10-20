import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { VehicleDeliveryPage } from '../../pages/vehicle-delivery.page.js';
import { ReturnListPage } from '../../pages/return-list.page.js';
import { VehicleReturnPage } from '../../pages/vehicle-return.page.js';

async function withPage(run, options = {}) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(options);
    await run(page);
  } finally {
    await browser.close();
  }
}

async function mockReturnListApi(page) {
  await page.route('**/api/short-term-rental/**', route =>
    route.fulfill({ json: { result: [], total: 0 } }));
}

test('Teslim formu hasarı kaydeder, belgeyi ve altı araç fotoğrafını yükler', async () => {
  await withPage(async page => {
    await page.setContent(`
      <main>
        <label for="plate">Araç Plakası</label>
        <input id="plate" type="text" value="06 ABC 123" disabled>
        <label for="damage">Teslim Hasar Detayı Teslim Hasar Detayı</label>
        <textarea id="damage"></textarea>
        <button id="save-form">Form Bilgilerini Kaydet</button>
        <button id="upload-form">Formu Yükle</button>
        <button id="send-rental">Kiraya Yönlendir</button>
      </main>
      <div id="document-dialog" role="dialog" hidden>
        <input id="document" type="file">
        <button id="save-document">Kaydet</button>
      </div>
      <div id="photo-dialog" role="dialog" hidden>
        <input id="photos" type="file" multiple>
        <button id="save-photos">Kaydet</button>
      </div>
      <script>
        document.querySelector('#save-form').onclick = () => {
          document.body.dataset.formSaved = 'true';
        };
        document.querySelector('#upload-form').onclick = () => {
          document.querySelector('#document-dialog').hidden = false;
        };
        document.querySelector('#save-document').onclick = () => {
          document.querySelector('#document-dialog').hidden = true;
        };
        document.querySelector('#send-rental').onclick = () => {
          document.querySelector('#photo-dialog').hidden = false;
        };
        document.querySelector('#save-photos').onclick = () => {
          document.querySelector('#photo-dialog').hidden = true;
          document.body.dataset.deliveryComplete = 'true';
        };
      </script>
    `);

    const result = await new VehicleDeliveryPage(page, { timeout: 2_000 }).complete();

    assert.equal(result.plate, '06ABC123');
    assert.equal(await page.locator('#damage').inputValue(), 'aracın bir hasarı bulunmamıştır');
    assert.equal(await page.locator('#document').evaluate(input => input.files.length), 1);
    assert.equal(await page.locator('#photos').evaluate(input => input.files.length), 6);
    assert.equal(await page.locator('body').getAttribute('data-form-saved'), 'true');
    assert.equal(await page.locator('body').getAttribute('data-delivery-complete'), 'true');
  });
});

test('İade listesi kimlikle filtrelenir ve ilk satır yerine plakalı form action açılır', async () => {
  await withPage(async page => {
    await mockReturnListApi(page);
    await page.route('**/reservation/return-list*', route => route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: `
        <label for="search">Herhangi bir şey arayın</label>
        <input id="search" placeholder="Herhangi bir şey arayın">
        <table><tbody>
          <tr id="wrong"><td>34YANLIS1</td><td>
            <button><i class="mdi-file-sign"></i></button>
            <button><i class="mdi-chevron-right"></i></button>
          </td></tr>
          <tr id="target"><td>06 ABC 123</td><td>
            <button id="open-target"><i class="mdi-file-sign"></i></button>
            <button><i class="mdi-chevron-right"></i></button>
          </td></tr>
        </tbody></table>
        <script>
          fetch('/api/short-term-rental/');
          document.querySelector('#search').addEventListener('keydown', event => {
            if (event.key === 'Enter') {
              history.replaceState({}, '', '/reservation/return-list?search=' + event.target.value);
              fetch('/api/short-term-rental/?search=' + event.target.value);
            }
          });
          document.querySelector('#open-target').onclick = () => {
            document.querySelector('#target').dataset.opened = 'true';
            history.pushState({}, '', '/return/return-id');
          };
        </script>
      `,
    }));

    const result = await new ReturnListPage(page, { timeout: 2_000 }).openAndSelect({
      customerIdentity: '12345678901',
      vehiclePlate: '06ABC123',
      reservationCode: 'ZF-NOT-SHOWN-IN-TABLE',
      reservationId: 'reservation-not-shown-in-table',
    });

    assert.match(result.rowText, /06 ABC 123/);
    assert.equal(await page.locator('#target').getAttribute('data-opened'), 'true');
    assert.equal(await page.locator('#wrong').getAttribute('data-opened'), null);
    assert.equal(new URL(page.url()).pathname, '/return/return-id');
  }, { baseURL: 'https://fys.local' });
});

test('İade listesinde aynı plakalı iki satır varsa sessizce ilkine tıklanmaz', async () => {
  await withPage(async page => {
    await mockReturnListApi(page);
    await page.route('**/reservation/return-list*', route => route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: `
        <label for="search">Herhangi bir şey arayın</label>
        <input id="search" placeholder="Herhangi bir şey arayın">
        <table><tbody>
          <tr><td>06ABC123</td><td><button><i class="mdi-file-sign"></i></button></td></tr>
          <tr><td>06 ABC 123</td><td><button><i class="mdi-file-sign"></i></button></td></tr>
        </tbody></table>
        <script>
          fetch('/api/short-term-rental/');
          document.querySelector('#search').addEventListener('keydown', event => {
            if (event.key === 'Enter') {
              history.replaceState({}, '', '/reservation/return-list?search=' + event.target.value);
              fetch('/api/short-term-rental/?search=' + event.target.value);
            }
          });
        </script>
      `,
    }));

    await assert.rejects(
      () => new ReturnListPage(page, { timeout: 1_000 }).openAndSelect({
        customerIdentity: '12345678901',
        vehiclePlate: '06ABC123',
      }),
      /tek satır bekleniyordu; 2 eşleşme bulundu/,
    );
  }, { baseURL: 'https://fys.local' });
});

test('İade aramasında URL değişse de eski aynı plakalı satırlar seçilmez; API beklenir', async () => {
  await withPage(async page => {
    await mockReturnListApi(page);
    await page.route('**/reservation/return-list*', route => route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: `
        <label for="search">Herhangi bir şey arayın</label><input id="search">
        <table><tbody>
          <tr id="old"><td>06ABC123 Eski müşteri</td>
            <td><button><i class="mdi-file-sign"></i></button></td></tr>
          <tr id="target"><td>06ABC123 Test müşterisi</td>
            <td><button id="open"><i class="mdi-file-sign"></i></button></td></tr>
        </tbody></table>
        <script>
          fetch('/api/short-term-rental/');
          document.querySelector('#search').onkeydown = event => {
            if (event.key !== 'Enter') return;
            history.replaceState({}, '', '/reservation/return-list?search=' + event.target.value);
            setTimeout(async () => {
              await fetch('/api/short-term-rental/?search=' + event.target.value);
              document.querySelector('#old').remove();
            }, 700);
          };
          document.querySelector('#open').onclick = () => {
            document.body.dataset.correctRowOpened = 'true';
            history.pushState({}, '', '/return/test-reservation');
          };
        </script>
      `,
    }));
    const result = await new ReturnListPage(page, { timeout: 3_000 }).openAndSelect({
      customerIdentity: '12345678901', vehiclePlate: '06ABC123',
    });
    assert.match(result.rowText, /Test müşterisi/);
    assert.equal(await page.locator('body').getAttribute('data-correct-row-opened'), 'true');
  }, { baseURL: 'https://fys.local' });
});

test('İade formu teslim KM üzerine 30 ekler, yakıtı doğrudan doldurur ve Tamam ile biter', async () => {
  await withPage(async page => {
    await page.setContent(`
      <main><form>
        <label for="delivery-km">Teslim KM</label>
        <input id="delivery-km" type="number" value="33600" disabled>
        <label for="delivery-fuel">Teslim Yakıtı</label>
        <input id="delivery-fuel" type="number" value="4" disabled>
        <label for="return-km">İade KM</label>
        <input id="return-km" type="number">
        <label for="return-fuel">İade Yakıtı</label>
        <input id="return-fuel" type="number">
        <label for="damage">İade Hasar Detayı</label>
        <textarea id="damage"></textarea>
        <button id="save-form" type="button">Form Bilgilerini Kaydet</button>
      </form></main>
      <button id="confirm" hidden>Tamam</button>
      <script>
        document.querySelector('#save-form').onclick = () => {
          document.querySelector('#confirm').hidden = false;
        };
        document.querySelector('#confirm').onclick = () => {
          document.body.dataset.confirmed = 'true';
          document.querySelector('#confirm').hidden = true;
        };
      </script>
    `);

    const result = await new VehicleReturnPage(page, {
      timeout: 2_000,
      confirmationTimeout: 500,
    }).complete();

    assert.deepEqual(result, {
      mode: 'confirmed', deliveryKm: 33600, returnKm: 33630, fuelAmount: 2,
    });
    assert.equal(await page.locator('#return-km').inputValue(), '33630');
    assert.equal(await page.locator('#return-fuel').inputValue(), '2');
    assert.equal(await page.locator('#damage').inputValue(), 'aracın yeni hasarı yok');
    assert.equal(await page.locator('body').getAttribute('data-confirmed'), 'true');
  });
});

test('İade sayfasının boş ve kilitli route kabuğu form verisi sanılmaz', async () => {
  await withPage(async page => {
    await page.setContent(`
      <main><form>
        <p>Teslim KM</p><input id="delivery-km" type="number" disabled>
        <p>Teslim Yakıtı</p><input id="delivery-fuel" type="number" disabled>
        <p>İade KM</p><input id="return-km" type="number" disabled>
        <p>İade Yakıtı</p><input id="return-fuel" type="number" disabled>
        <label for="damage">İade Hasar Detayı İade Hasar Detayı</label>
        <textarea id="damage" disabled></textarea>
        <button id="save-form" type="button">Form Bilgilerini Kaydet</button>
      </form></main>
      <button id="confirm" hidden>Tamam</button>
      <script>
        setTimeout(() => {
          document.querySelector('#delivery-km').value = '5000';
          document.querySelector('#delivery-fuel').value = '4';
          document.querySelector('#return-km').disabled = false;
          document.querySelector('#return-fuel').disabled = false;
          document.querySelector('#damage').disabled = false;
        }, 100);
        document.querySelector('#save-form').onclick = () => {
          document.querySelector('#confirm').hidden = false;
        };
        document.querySelector('#confirm').onclick = event => {
          event.target.hidden = true;
        };
      </script>
    `);

    const result = await new VehicleReturnPage(page, {
      timeout: 2_000,
      confirmationTimeout: 500,
    }).complete();

    assert.equal(result.deliveryKm, 5000);
    assert.equal(result.returnKm, 5030);
    assert.equal(await page.locator('#return-fuel').inputValue(), '2');
  });
});

test('Tamam çıkmazsa iade wizardı belge, fotoğraf, yıkama ve yakıt adımlarını tamamlar', async () => {
  await withPage(async page => {
    await page.setContent(`
      <main><form>
        <p>Teslim KM</p>
        <input id="delivery-km" type="number" value="1000" disabled>
        <p>Teslim Yakıtı</p>
        <input id="delivery-fuel" type="number" value="3" disabled>
        <p>İade KM</p>
        <input id="return-km" type="number">
        <p>İade Yakıtı</p>
        <input id="return-fuel" type="number">
        <label for="damage">İade Hasar Detayı İade Hasar Detayı</label>
        <textarea id="damage"></textarea>
        <button id="save-form" type="button">Form Bilgilerini Kaydet</button>
        <button id="upload-form" type="button">Formu Yükle</button>
        <button id="complete-form" type="button" hidden>Tamamla</button>
        <button id="next" type="button" hidden>İLERİ</button>
        <fieldset id="washing" hidden>
          <label><input id="normal-wash" type="radio" name="washing">Normal Yıkama</label>
        </fieldset>
        <fieldset id="fuel-step" hidden>
          <label><input id="fuel-needed" type="radio" name="fuel">Yakıt Alınacak</label>
          <button id="final-save" type="button">Kaydet</button>
        </fieldset>
      </form></main>
      <div id="document-dialog" role="dialog" hidden>
        <input id="document" type="file">
        <button id="save-document">Kaydet</button>
      </div>
      <div id="photo-dialog" role="dialog" hidden>
        <input id="photos" type="file" multiple>
        <button id="save-photos">Kaydet</button>
      </div>
      <script>
        let stage = 0;
        const next = document.querySelector('#next');
        document.querySelector('#upload-form').onclick = () => {
          document.querySelector('#document-dialog').hidden = false;
        };
        document.querySelector('#save-document').onclick = () => {
          document.querySelector('#document-dialog').hidden = true;
          document.querySelector('#complete-form').hidden = false;
        };
        document.querySelector('#complete-form').onclick = event => {
          event.target.hidden = true;
          stage = 1;
          next.hidden = false;
        };
        next.onclick = () => {
          if (stage === 1) {
            next.hidden = true;
            document.querySelector('#photo-dialog').hidden = false;
          } else if (stage === 2) {
            stage = 3;
            document.querySelector('#washing').hidden = false;
          } else if (stage === 3) {
            next.hidden = true;
            document.querySelector('#washing').hidden = true;
            document.querySelector('#fuel-step').hidden = false;
          }
        };
        document.querySelector('#save-photos').onclick = () => {
          document.querySelector('#photo-dialog').hidden = true;
          stage = 2;
          next.hidden = false;
        };
        document.querySelector('#final-save').onclick = () => {
          document.body.dataset.returnComplete = 'true';
          document.querySelector('#fuel-step').hidden = true;
        };
      </script>
    `);

    const result = await new VehicleReturnPage(page, {
      timeout: 2_000,
      confirmationTimeout: 50,
    }).complete();

    assert.equal(result.mode, 'wizard');
    assert.equal(result.returnKm, 1030);
    assert.equal(await page.locator('#document').evaluate(input => input.files.length), 1);
    assert.equal(await page.locator('#photos').evaluate(input => input.files.length), 6);
    assert.equal(await page.locator('#normal-wash').isChecked(), true);
    assert.equal(await page.locator('#fuel-needed').isChecked(), true);
    assert.equal(await page.locator('body').getAttribute('data-return-complete'), 'true');
  });
});
