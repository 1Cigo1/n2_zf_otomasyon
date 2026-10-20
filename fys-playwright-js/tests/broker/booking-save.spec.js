import assert from 'node:assert/strict';
import { test } from '../../fixtures/test.js';
import { requireWriteAccess } from '../../config/environments.js';
import { createBrokerRequest } from '../../api/broker/client.js';
import {
  AVAILABLE_PATH, SAVE_PATH, customerFromEnv, exportCiCancelReceipt,
  firstBookableCar, saveParams, searchParams, writeBookingReceipt,
} from '../../api/broker/booking.js';
import {
  fieldText, inspectXmlResponse, parseXml, saveErrorResponse, saveXml, xmlHasError,
} from '../../api/broker/xml.js';
import { requireBrokerOrSkip } from './common.js';

test('Müsait araçtaki Rez_ID ile rezervasyon kaydet @broker-save', async ({ playwright, env }) => {
  test.skip(env.name !== 'dev', 'Rezervasyon kaydı yalnız dev ortamında denenir.');
  test.skip(process.env.RUN_BROKER_SAVE?.toLowerCase() !== 'true',
    'Kaydetmek için RUN_BROKER_SAVE=true gerekli.');
  requireWriteAccess(env); // ALLOW_WRITE_TESTS=true ve izin verilen dev host gerekir.
  requireBrokerOrSkip(test);

  // 1. Test müşterisini hazırla ve müsait araçları yeniden getir.
  const { customer, generated } = customerFromEnv();
  const broker = await createBrokerRequest(playwright, env);
  try {
    // Rez_ID her aramada değişebilir. Kaydetmeden hemen önce yeni GET yapıyoruz.
    const search = searchParams();
    const availableResponse = await broker.get(AVAILABLE_PATH, {
      params: search, timeout: 60_000, retryOnce: true,
    });
    const cars = await inspectXmlResponse(availableResponse, {
      title: 'Kayıt öncesi müsait araçlar', fileName: 'kayit_oncesi_musait_araclar.xml',
      recordTag: 'Car', fields: ['Rez_ID', 'Group_ID', 'Car_Name', 'Brand', 'Type'],
    });
    const car = firstBookableCar(cars);

    // 2. GET'teki tarihleri, ofisleri, Rez_ID ve Group_ID'yi POST'a taşı.
    const params = saveParams(search, car, customer);
    for (const [name, value] of Object.entries(search)) assert.equal(params[name], value);
    assert.equal(params.Rez_ID, fieldText(car, 'Rez_ID'));
    assert.equal(params.Group_ID, fieldText(car, 'Group_ID'));

    // 3. Hangi Rez_ID için istek gönderileceğini dosyaya kaydet.
    const receipt = {
      Rez_ID: params.Rez_ID,
      Group_ID: params.Group_ID,
      search_params: search,
      car_name: fieldText(car, 'Car_Name'),
      state: 'save_request_prepared',
      environment: env.name,
      created_at: new Date().toISOString(),
    };
    if (generated) receipt.generated_test_passport_id = params.Rental_ID;
    await writeBookingReceipt(receipt);

    // 4. Postman gibi: POST gövdesi boş, alanlar URL/Params bölümünde.
    const response = await broker.post(SAVE_PATH, { params });
    receipt.save_http_status = response.status();
    const body = await response.text();
    if (![200, 201].includes(response.status())) {
      receipt.state = 'save_http_error_business_result_unverified';
      await writeBookingReceipt(receipt);
      const file = await saveErrorResponse('rezervasyon_kaydet_hata', body);
      throw new Error(`Rezervasyon kaydet: HTTP ${response.status()}. Yanıt: ${file}`);
    }

    const xml = parseXml(body);
    const xmlFile = await saveXml('rezervasyon_kaydet.xml', xml);
    if (xmlHasError(xml.root)) {
      receipt.state = 'save_xml_error_business_result_unverified';
      await writeBookingReceipt(receipt);
      throw new Error(`Rezervasyon kaydet XML hata döndürdü: ${xmlFile}`);
    }
    if (fieldText(xml.root, 'Key') !== params.Rez_ID || fieldText(xml.root, 'Status') !== '200') {
      receipt.state = 'save_xml_unexpected_business_result_unverified';
      await writeBookingReceipt(receipt);
      throw new Error(`Rezervasyon yanıtında Key/Status beklenenden farklı: ${xmlFile}`);
    }

    // 5. Yalnız başarılı yanıtı daha sonra iptal edilebilecek kayıt olarak işaretle.
    receipt.state = 'save_xml_key_status_matched';
    const latest = await writeBookingReceipt(receipt, true);
    await exportCiCancelReceipt(receipt); // Yalnız Rez_ID, ortam ve durum.
    console.log(`\nRezervasyon kaydet isteği gönderildi. Rez_ID: ${params.Rez_ID}`);
    console.log(`POST yanıt XML'i: ${xmlFile}`);
    console.log(`Son rezervasyon kaydı: ${latest}`);
    console.log('İptal isteği bu testte gönderilmedi.');
  } finally {
    await broker.dispose();
  }
});
