import { test } from '../../fixtures/test.js';
import { createBrokerRequest } from '../../api/broker/client.js';
import { AVAILABLE_PATH, firstBookableCar, searchParams } from '../../api/broker/booking.js';
import { inspectXmlResponse } from '../../api/broker/xml.js';
import { requireBrokerOrSkip } from './common.js';

test('Müsait araçları gelecek tarihler için XML olarak göster @broker-read', async ({ playwright, env }) => {
  requireBrokerOrSkip(test);
  const search = searchParams(); // Varsayılan: 7 gün sonra al, 2 gün kirala.
  const broker = await createBrokerRequest(playwright, env);
  try {
    const response = await broker.get(AVAILABLE_PATH, {
      params: search, timeout: 60_000, retryOnce: true,
    });
    const cars = await inspectXmlResponse(response, {
      title: 'Müsait Araçlar', fileName: 'musait_araclar.xml', recordTag: 'Car',
      fields: ['Rez_ID', 'Group_ID', 'Car_Name', 'Brand', 'Type', 'Total_Rental'],
    });
    firstBookableCar(cars);
    console.log(
      `Arama tarihleri: ${search.Pickup_Day}.${search.Pickup_Month}.${search.Pickup_Year}` +
      ` → ${search.Drop_Off_Day}.${search.Drop_Off_Month}.${search.Drop_Off_Year}`,
    );
  } finally {
    await broker.dispose();
  }
});
