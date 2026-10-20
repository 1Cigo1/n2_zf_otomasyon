import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { firstBookableCar, saveParams, searchParams, customerFromEnv,
  AVAILABLE_PATH, CANCEL_PATH } from '../../api/broker/booking.js';
import { createBrokerRequest } from '../../api/broker/client.js';
import { fieldText, parseXml, recordsOf, xmlHasError } from '../../api/broker/xml.js';
import { requireBrokerOrSkip } from '../broker/common.js';

// Gerçek rezervasyon raporlarına dokunmadan dosya üreten yardımcıları dener.
async function inTemporaryProject(run) {
  const original = process.cwd();
  const directory = await mkdtemp(path.join(os.tmpdir(), 'broker-unit-'));
  process.chdir(directory);
  try {
    const booking = await import(`../../api/broker/booking.js?unit=${Date.now()}-${Math.random()}`);
    await run(booking);
  } finally {
    process.chdir(original);
    await rm(directory, { recursive: true, force: true });
  }
}

async function withTemporaryEnv(changes, run) {
  // Değerler yalnız bellekte tutulur; rapora veya dosyaya yazılmaz.
  const previous = Object.fromEntries(
    Object.keys(changes).map(name => [name, process.env[name]]),
  );
  try {
    for (const [name, value] of Object.entries(changes)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    return await run();
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test('Yıl değişirken arama tarihi ileri gider ve kaydetme parametreleri aynı kalır', () => {
  const search = searchParams(new Date('2026-12-30T23:30:00Z'), {
    BROKER_DAYS_AHEAD: '7', BROKER_RENTAL_DAYS: '2', BROKER_HOUR: '18',
  });
  assert.equal(`${search.Pickup_Day}.${search.Pickup_Month}.${search.Pickup_Year}`, '7.1.2027');
  assert.equal(`${search.Drop_Off_Day}.${search.Drop_Off_Month}.${search.Drop_Off_Year}`, '9.1.2027');

  const car = firstBookableCar([
    { Rez_ID: '', Group_ID: 'grup-bos' },
    { Rez_ID: 'TRS-123', Group_ID: 'grup-1', Car_Name: 'Test aracı' },
  ]);
  const params = saveParams(search, car, {
    Rental_ID: 'T12345678', Name: 'Test', SurName: 'Kisi',
    MobilePhone: '5550000000', Mail_Adress: 'test@example.invalid',
  }, {});
  for (const [key, value] of Object.entries(search)) assert.equal(params[key], value);
  assert.equal(params.Rez_ID, 'TRS-123');
  assert.equal(params.Group_ID, 'grup-1');
});

test('XML içindeki araç kimliklerini okur ve hata öğesini tanır', () => {
  const document = parseXml('<Cars><Car><Rez_ID>TRS-123</Rez_ID><Group_ID>grup-1</Group_ID></Car></Cars>');
  const cars = recordsOf(document, 'Car');
  assert.equal(cars.length, 1);
  assert.equal(fieldText(cars[0], 'Rez_ID'), 'TRS-123');
  assert.equal(xmlHasError(document.root), false);
  assert.equal(xmlHasError(parseXml('<Response><Error>Hata</Error></Response>').root), true);
});

test('Bugün veya geçmiş gün için arama yapılamaz', () => {
  assert.throws(() => searchParams(new Date('2026-10-15T09:00:00Z'), {
    BROKER_DAYS_AHEAD: '0', BROKER_RENTAL_DAYS: '2',
  }), /BROKER_DAYS_AHEAD/);
});

test('GET kimlikleri ve tarihler POST parametrelerine taşınır', () => {
  const search = searchParams(new Date('2026-10-15T09:00:00Z'), {});
  const car = firstBookableCar(recordsOf(parseXml(
    '<Response><Car><Rez_ID>TRS-ABC</Rez_ID><Group_ID>GRUP-1</Group_ID></Car></Response>',
  ), 'Car'));
  const customer = { Rental_ID: 'TEST-PASAPORT', Name: 'Test', SurName: 'Kullanici',
    MobilePhone: '5550000000', Mail_Adress: 'test@example.invalid' };
  const post = saveParams(search, car, customer, {});
  for (const [key, value] of Object.entries(search)) assert.equal(post[key], value);
  assert.equal(post.Rez_ID, 'TRS-ABC');
  assert.equal(post.Group_ID, 'GRUP-1');
  assert.equal(post.Rental_ID, 'TEST-PASAPORT');
  assert.equal(post.Ecop_ID, 'Korall55');
  assert.equal('Full_Credit' in post, false);
  assert.equal(saveParams(search, car, customer, { BROKER_FULL_CREDIT: 'true' }).Full_Credit, 'TRUE');
});

test('Başarısız kayıt son iptal hedefi olmaz; doğrulanmış kayıt olur', async () => {
  await inTemporaryProject(async booking => {
    const receipt = { Rez_ID: 'TRS-TEST', state: 'save_http_error' };
    await booking.writeBookingReceipt(receipt);
    await assert.rejects(() => stat(booking.LATEST_BOOKING), { code: 'ENOENT' });
    receipt.state = 'save_xml_key_status_matched';
    await booking.writeBookingReceipt(receipt, true);
    assert.equal((await booking.readLatestBooking()).state, 'save_xml_key_status_matched');
  });
});

test('GitLab iptal devrinde müşteri ve test pasaport alanları yoktur', async () => {
  await inTemporaryProject(async booking => {
    const receipt = { Rez_ID: 'TRS-ORNEK', environment: 'dev',
      state: 'save_xml_key_status_matched', generated_test_passport_id: 'T12345678',
      Name: 'Ornek' };
    await booking.exportCiCancelReceipt(receipt);
    assert.deepEqual(JSON.parse(await readFile(booking.CI_CANCEL_RECEIPT, 'utf8')), {
      Rez_ID: 'TRS-ORNEK', environment: 'dev', state: 'save_xml_key_status_matched',
    });
  });
});

test('Yeni test pasaport kimliği istenen biçimde üretilir', () => {
  const { customer, generated } = customerFromEnv({
    BROKER_GENERATE_RENTAL_ID: 'true', BROKER_TEST_NAME: 'Test',
    BROKER_TEST_SURNAME: 'Kullanici', BROKER_TEST_MOBILE_PHONE: '5550000000',
    BROKER_TEST_EMAIL: 'test@example.invalid',
  });
  assert.equal(generated, true);
  assert.match(customer.Rental_ID, /^T[0-9]{8}$/);
});

test('CI ortamında eksik broker ayarı testi başarısız yapar', async () => {
  await withTemporaryEnv({
    CI: 'true', BROKER_TOKEN: undefined,
    BROKER_COMPANY_ID: 'test-company', BROKER_APPLICATION_ID: 'test-application',
  }, () => {
    assert.throws(() => requireBrokerOrSkip({ skip: () => { throw new Error('skipped'); } }),
      /BROKER_TOKEN/);
  });
});

test('Açık broker komutunda eksik ayar adları hata olarak görünür', async () => {
  await withTemporaryEnv({
    CI: undefined, BROKER_REQUIRE_CONFIG: 'true', BROKER_TOKEN: undefined,
    BROKER_COMPANY_ID: 'test-company', BROKER_APPLICATION_ID: 'test-application',
  }, () => {
    assert.throws(() => requireBrokerOrSkip({ skip: () => { throw new Error('skipped'); } }),
      /Broker ayarı eksik: BROKER_TOKEN/);
  });
});

test('Yalnız müsait araç GET tekrar edilir; iptal ve POST tekrar edilmez', async () => {
  await withTemporaryEnv({
    BROKER_TOKEN: 'synthetic-unit-secret',
    BROKER_COMPANY_ID: 'test-company', BROKER_APPLICATION_ID: 'test-application',
  }, async () => {
    const calls = [];
    const context = {
      get: async url => {
        calls.push(url);
        if (url === AVAILABLE_PATH && calls.filter(item => item === url).length === 1) {
          throw new Error('socket hang up\nAuthorization: Token synthetic-unit-secret');
        }
        if (url === CANCEL_PATH) {
          throw new Error('socket hang up\nAuthorization: Token synthetic-unit-secret');
        }
        return { status: () => 200 };
      },
      post: async url => { calls.push(url); throw new Error('socket hang up'); },
      dispose: async () => {},
    };
    const playwright = { request: { newContext: async () => context } };
    const client = await createBrokerRequest(playwright, { baseURL: 'https://example.invalid' });
    await client.get(AVAILABLE_PATH, { retryOnce: true });
    await assert.rejects(() => client.get(CANCEL_PATH, { params: { Rez_ID: 'TEST' } }), error =>
      error.message.includes('bağlantı kapatıldı') && !error.message.includes('synthetic-unit-secret'));
    await assert.rejects(() => client.post('/save'), /bağlantı kapatıldı/);
    assert.deepEqual(calls, [AVAILABLE_PATH, AVAILABLE_PATH, CANCEL_PATH, '/save']);
    await client.dispose();
  });
});
