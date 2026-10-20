import { test, expect } from '../../fixtures/test.js';
import { FysClient } from '../../api/fys.client.js';

test('Oturumsuz kullanıcı profil API erişimi reddedilir @api', async ({ request }) => {
  const response = await request.get('/api/auth/me', { maxRedirects: 0 });
  expect([401, 403]).toContain(response.status());
});

test('Login API, kullanıcı bilgisi ve yıkama listesi sözleşmesi @api', async ({ request, credentials, env }) => {
  const api = new FysClient(request);
  await api.login(credentials);
  await api.me();
  await api.washingList(env.workflowKey);
});

test('Login sayfasının tema API yanıtı geçerli @api', async ({ request }) => {
  const response = await request.get('/api/company/themes');
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).toHaveProperty('colors');
  expect(body).toHaveProperty('assets');
  expect(body).toHaveProperty('login_config');
});
