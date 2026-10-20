import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basename } from 'node:path';
import { chromium } from '@playwright/test';
import { RentalAgreementFlow } from '../../components/reservations/rental-agreement.flow.js';
import {
  DEFAULT_CONTRACT_DOCUMENT,
  testDataFixture,
} from '../../support/file-upload.js';

async function agreementPage(page, { showProvision = true } = {}) {
  await page.setContent(`
    <main>
      <button id="create">Sözleşme oluştur</button>
      <button id="upload" hidden>Sözleşme Yükle</button>
      <button id="provision" ${showProvision ? 'hidden' : 'hidden'}>Provizyon Al</button>
      <button id="delivery" hidden>Teslimata Yönlendir</button>
    </main>

    <script>
      const main = document.querySelector('main');
      document.querySelector('#create').onclick = () => {
        main.dataset.contractCreated = 'true';
        document.querySelector('#upload').hidden = false;
      };
      document.querySelector('#upload').onclick = () => {
        document.body.insertAdjacentHTML('beforeend',
          '<section class="v-dialog" role="dialog" id="upload-dialog">' +
          '<label for="contract-file">Dosya</label>' +
          '<input id="contract-file" type="file">' +
          '<button id="save-upload">Kaydet</button>' +
          '</section>');
        document.querySelector('#save-upload').onclick = () => {
          const input = document.querySelector('#contract-file');
          main.dataset.uploadedFile = input.files[0]?.name || '';
          document.querySelector('#upload-dialog').remove();
          document.querySelector('#provision').hidden = ${showProvision ? 'false' : 'true'};
          document.querySelector('#delivery').hidden = false;
        };
      };
      document.querySelector('#provision').onclick = () => {
        main.dataset.provisionOpened = 'true';
        document.querySelector('#provision').hidden = true;
        main.insertAdjacentHTML('beforeend',
          '<section id="provision-controls">' +
          '<label for="provision-amount">Provizyon Tutarı Provizyon Tutarı</label>' +
          '<input id="provision-amount" type="number">' +
          '<button class="v-btn text-error" id="cancel-provision"><i class="mdi-close"></i></button>' +
          '<button class="v-btn text-success" id="confirm-provision"><i class="mdi-check"></i></button>' +
          '</section>');
        document.querySelector('#confirm-provision').onclick = () => {
          main.dataset.provisionAmount = document.querySelector('#provision-amount').value;
          document.querySelector('#provision-controls').hidden = true;
          document.body.insertAdjacentHTML('beforeend',
            '<section class="v-dialog" role="dialog" id="confirmation-dialog">' +
            '<button id="yes">Evet</button>' +
            '</section>');
          document.querySelector('#yes').onclick = () => {
            main.dataset.provisionConfirmed = 'true';
            document.querySelector('#confirmation-dialog').remove();
            document.querySelector('#provision-controls').remove();
          };
        };
      };
      document.querySelector('#delivery').onclick = () => {
        main.dataset.sentToDelivery = 'true';
        main.insertAdjacentHTML('beforeend',
          '<label for="delivery-damage">Teslim Hasar Detayı</label>' +
          '<textarea id="delivery-damage"></textarea>');
      };
    </script>
  `);
}

test('Fixture yolu çalışma dizininden bağımsız ve test-data ile sınırlıdır', () => {
  assert.equal(basename(DEFAULT_CONTRACT_DOCUMENT), 'front.jpg');
  assert.equal(testDataFixture('photos/front.jpg'), DEFAULT_CONTRACT_DOCUMENT);
  assert.throws(
    () => testDataFixture('../package.json'),
    /test-data dizininin dışında/,
  );
});

test('Kısa dönemde sözleşme yüklenir, sıfır provizyon alınır ve teslimata yönlendirilir', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await agreementPage(page, { showProvision: true });

    const result = await new RentalAgreementFlow(page, {
      actionTimeout: 3000,
    }).createUploadAndSend({
      requiresProvision: true,
      provisionAmount: '0',
    });

    const main = page.locator('main');
    assert.equal(await main.getAttribute('data-contract-created'), 'true');
    assert.equal(await main.getAttribute('data-uploaded-file'), 'front.jpg');
    assert.equal(await main.getAttribute('data-provision-opened'), 'true');
    assert.equal(await main.getAttribute('data-provision-amount'), '0');
    assert.equal(await main.getAttribute('data-provision-confirmed'), 'true');
    assert.equal(await main.getAttribute('data-sent-to-delivery'), 'true');
    assert.equal(result.provisionAmount, '0');
    assert.equal(result.uploaded.fileName, 'front.jpg');
    assert.equal(await page.locator('[role="dialog"]:visible').count(), 0);
  } finally {
    await browser.close();
  }
});

test('Kurumsal kısa dönemde provizyon atlanır ama ortak sözleşme akışı kullanılır', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await agreementPage(page, { showProvision: false });

    const result = await new RentalAgreementFlow(page, {
      actionTimeout: 3000,
    }).createUploadAndSend({ requiresProvision: false });

    const main = page.locator('main');
    assert.equal(await main.getAttribute('data-uploaded-file'), 'front.jpg');
    assert.equal(await main.getAttribute('data-provision-opened'), null);
    assert.equal(await main.getAttribute('data-sent-to-delivery'), 'true');
    assert.equal(result.provisionAmount, null);
  } finally {
    await browser.close();
  }
});


test('Teslim ön kontrolü reddedince API mesajı gösterilir ve teslim formu beklenmez', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route('https://fys.test/**', async route => {
      if (route.request().url().endsWith('/delivery-precheck/')) {
        await route.fulfill({ json: {
          status: false, can_navigate: false,
          issues: [{ code: 'reservation_days_mismatch',
            message: 'Rezervasyon tarihleri güncellenmeden teslimata devam edemezsiniz.' }],
        } });
        return;
      }
      await route.fulfill({ contentType: 'text/html; charset=utf-8', body: `
        <main><button id="delivery">Teslimata Yönlendir</button></main>
        <script>
          document.querySelector('#delivery').onclick = () =>
            fetch('/api/short-term-rental/test-id/delivery-precheck/');
        </script>
      ` });
    });
    await page.goto('https://fys.test/reservation/edit/test-id');
    await assert.rejects(
      () => new RentalAgreementFlow(page, { actionTimeout: 3000 }).sendToDelivery(),
      /Teslimata yönlendirme reddedildi: Rezervasyon tarihleri güncellenmeden/,
    );
    assert.equal(await page.getByRole('textbox').count(), 0);
  } finally {
    await browser.close();
  }
});
