import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from '../../fixtures/test.js';
import { createBrokerRequest } from '../../api/broker/client.js';
import { inspectXmlResponse, fieldText } from '../../api/broker/xml.js';
import { requireBrokerOrSkip } from './common.js';

const collectionFile = fileURLToPath(new URL('./data/broker_get.postman_collection.json', import.meta.url));

// Collection'dan yalnız istek URL'sini alıyoruz; kontrol edilecek XML alanları aşağıda yazılı.
async function requestPathFromCollection(requestName) {
  const collection = JSON.parse(await readFile(collectionFile, 'utf8'));
  const item = collection.item.find((candidate) => candidate.name === requestName);
  assert.ok(item, `Collection içinde ${requestName} bulunamadı.`);
  assert.equal(item.request.method, 'GET');
  assert.ok(item.request.url.startsWith('{{BASE_URL}}/'), 'Collection URL biçimi beklenenden farklı.');
  return item.request.url.replace('{{BASE_URL}}', '');
}

async function checkGetRequestFromCollection(playwright, env, settings) {
  const broker = await createBrokerRequest(playwright, env);
  try {
    const response = await broker.get(await requestPathFromCollection(settings.requestName));
    const records = await inspectXmlResponse(response, settings);
    for (const record of records) {
      for (const field of settings.fields) {
        assert.ok(fieldText(record, field), `${settings.title}: ${field} boş.`);
      }
    }
  } finally {
    await broker.dispose();
  }
}

test('Ek Hizmetler GET @broker-read', async ({ playwright, env }) => {
  requireBrokerOrSkip(test);
  await checkGetRequestFromCollection(playwright, env, {
    requestName: 'Ek Hizmetler', title: 'Ek Hizmetler',
    fileName: 'ek_hizmetler.xml', recordTag: 'MesajBilgi', fields: ['Kod', 'Desc'],
  });
});

test('Ofisler GET @broker-read', async ({ playwright, env }) => {
  requireBrokerOrSkip(test);
  await checkGetRequestFromCollection(playwright, env, {
    requestName: 'Ofisler', title: 'Ofisler',
    fileName: 'ofisler.xml', recordTag: 'Location', fields: ['Location_ID', 'Location_Name'],
  });
});

test('Araçlar GET @broker-read', async ({ playwright, env }) => {
  requireBrokerOrSkip(test);
  await checkGetRequestFromCollection(playwright, env, {
    requestName: 'Araçlar', title: 'Araçlar',
    fileName: 'araclar.xml', recordTag: 'Group', fields: ['Group_ID', 'Group_Name'],
  });
});

test('Araç Grupları GET @broker-read', async ({ playwright, env }) => {
  requireBrokerOrSkip(test);
  await checkGetRequestFromCollection(playwright, env, {
    requestName: 'Araç Grupları', title: 'Araç Grupları',
    fileName: 'arac_gruplari.xml', recordTag: 'Group', fields: ['Group_ID', 'Group_Name'],
  });
});
