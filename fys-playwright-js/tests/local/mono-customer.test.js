import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { MonoPage } from '../../pages/mono.page.js';

const customerData = {
  identity: '10000000001', firstName: 'Test', lastName: 'Müşterisi',
};

async function specialCustomerPage(page, searchStatus) {
  const requests = [];
  await page.route('https://fys.test/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/customer/') {
      requests.push(`search:${url.searchParams.get('search')}`);
      await route.fulfill({ status: searchStatus, json: { name: 'Test Müşterisi' } });
      return;
    }
    if (url.pathname === '/api/customer-partner/extra/add-vip-customers/') {
      requests.push('save');
      await route.fulfill({ json: { status: true } });
      return;
    }
    await route.fulfill({ contentType: 'text/html; charset=utf-8', body: `
      <a href="/customer/vip">Özel Tanımlı Müşteriler</a>
      <h1>Özel Tanımlı Müşteri Yönetimi</h1>
      <button id="new">Yeni</button>
      <script>
        document.querySelector('#new').onclick = () => {
          document.body.insertAdjacentHTML('beforeend',
            '<section class="v-dialog" role="dialog">' +
            '<label for="customer">Müşteriler Müşteriler</label>' +
            '<input id="customer">' +
            '<div id="options"></div><button id="save">Kaydet</button></section>');
          document.querySelector('#customer').oninput = async event => {
            const response = await fetch('/api/customer/?search=' + event.target.value);
            if (!response.ok) return;
            const customer = await response.json();
            document.querySelector('#options').innerHTML =
              '<button role="option">' + customer.name + '</button>';
            document.querySelector('[role="option"]').onclick = () => {
              document.querySelector('#options').innerHTML = '';
            };
          };
          document.querySelector('#save').onclick = async () => {
            await fetch('/api/customer-partner/extra/add-vip-customers/', { method: 'POST' });
            document.querySelector('[role="dialog"]').remove();
          };
        };
      </script>
    ` });
  });
  await page.goto('https://fys.test/customer/customer-list');
  return requests;
}

test('Özel müşteri seçimi kimlik araması tamamlandıktan sonra kaydedilir', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const requests = await specialCustomerPage(page, 200);
    const customer = { ...customerData };
    await new MonoPage(page).registerSpecialCustomer(customer);
    assert.deepEqual(requests, [`search:${customer.identity}`, 'save']);
    assert.equal(customer.specialCustomerCreated, true);
  } finally {
    await browser.close();
  }
});

test('Müşteri araması hata dönerse seçenek beklenmeden HTTP hatası gösterilir', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const requests = await specialCustomerPage(page, 500);
    const customer = { ...customerData };
    await assert.rejects(
      () => new MonoPage(page).registerSpecialCustomer(customer),
      /Özel müşteri arama API yanıtı/,
    );
    assert.deepEqual(requests, [`search:${customer.identity}`]);
    assert.equal(customer.specialCustomerCreated, undefined);
  } finally {
    await browser.close();
  }
});
