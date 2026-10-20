import assert from 'node:assert/strict';
import { test } from '../../fixtures/test.js';
import { requireWriteAccess } from '../../config/environments.js';
import { createBrokerRequest } from '../../api/broker/client.js';
import {
  CANCEL_PATH, readLatestBooking, writeBookingReceipt,
} from '../../api/broker/booking.js';
import { parseXml, saveErrorResponse, saveXml, xmlHasError } from '../../api/broker/xml.js';
import { requireBrokerOrSkip } from './common.js';

test('Kaydedilen Rez_ID ile rezervasyonu ayrı komutla iptal et @broker-cancel', async ({ playwright, env }) => {
  test.skip(env.name !== 'dev', 'Rezervasyon iptali yalnız dev ortamında denenir.');
  test.skip(process.env.RUN_BROKER_SAVE?.toLowerCase() === 'true',
    'Kayıt ve iptal aynı test çalışmasında yapılmaz.');
  test.skip(process.env.RUN_BROKER_CANCEL?.toLowerCase() !== 'true',
    'İptal için RUN_BROKER_CANCEL=true gerekli.');
  requireWriteAccess(env);

  // Kaydetme testinin bıraktığı son başarılı Rez_ID'yi oku.
  let receipt;
  try {
    receipt = await readLatestBooking();
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('İptal için önce rezervasyon kaydı çalıştırılmalı.');
    throw error;
  }
  assert.equal(receipt.environment, env.name, 'Rezervasyon farklı ortamda oluşturulmuş.');
  assert.equal(receipt.state, 'save_xml_key_status_matched',
    'Rezervasyon daha önce iptal isteği almış veya kayıt durumu uygun değil.');
  assert.ok(receipt.Rez_ID, 'Son rezervasyon dosyasında Rez_ID bulunamadı.');
  requireBrokerOrSkip(test);

  const broker = await createBrokerRequest(playwright, env);
  try {
    // Collection yöntemi GET olsa da bu çağrı sunucuya iptal isteği gönderir.
    const response = await broker.get(CANCEL_PATH, { params: { Rez_ID: receipt.Rez_ID } });
    const body = await response.text();
    if (response.status() !== 200) {
      const file = await saveErrorResponse('rezervasyon_iptal_hata', body);
      throw new Error(`Rezervasyon iptal: HTTP ${response.status()}. Yanıt: ${file}`);
    }
    const xml = parseXml(body);
    const xmlFile = await saveXml('rezervasyon_iptal.xml', xml);
    if (xmlHasError(xml.root)) throw new Error(`Rezervasyon iptal XML hata döndürdü: ${xmlFile}`);

    // HTTP 200 tek başına iş kuralı sonucunu kanıtlamaz.
    receipt.state = 'cancel_http_ok_business_result_unverified';
    await writeBookingReceipt(receipt, true);
    console.log(`\nİptal isteği gönderildi. Rez_ID: ${receipt.Rez_ID}`);
    console.log(`İptal yanıt XML'i: ${xmlFile}`);
  } finally {
    await broker.dispose();
  }
});
