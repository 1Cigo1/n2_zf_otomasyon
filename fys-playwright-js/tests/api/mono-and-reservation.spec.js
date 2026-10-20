import { test, expect } from '../../fixtures/test.js';
import { ReservationClient } from '../../api/reservation.client.js';

test('Oturumsuz Mono listesi erişimi reddedilir @api @mono-api', async ({ request }) => {
  const response = await request.get('/api/customer/', { maxRedirects: 0 });
  expect([401, 403]).toContain(response.status());
});

test('Mono ve özel tanımlı müşteri listeleri geçerli @api @mono-api', async ({ request, credentials }) => {
  const api = new ReservationClient(request);
  await api.login(credentials);
  await api.customers();
  await api.specialCustomers();
});

test('Oturumsuz rezervasyon listesi erişimi reddedilir @api @reservation-api', async ({ request }) => {
  const response = await request.get('/api/short-term-rental/', { maxRedirects: 0 });
  expect([401, 403]).toContain(response.status());
});

test('Kısa dönem rezervasyon listesi geçerli @api @reservation-api', async ({ request, credentials }) => {
  const api = new ReservationClient(request);
  await api.login(credentials);
  await api.reservations();
});
