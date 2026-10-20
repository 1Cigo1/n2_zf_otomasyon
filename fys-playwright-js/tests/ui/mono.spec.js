import { test, expect } from '../../fixtures/test.js';
import { LoginPage } from '../../pages/login.page.js';
import { MonoPage } from '../../pages/mono.page.js';
import { newTestCustomer } from '../../support/short-term-data.js';

test('Mono kişi oluşturulur ve özel tanımlı müşteri yapılır @mono-ui @ui @write', async ({ page, credentials, writeAccess }, testInfo) => {
  void writeAccess;
  const customer = newTestCustomer();
  const mono = new MonoPage(page);
  await new LoginPage(page).login(credentials);
  try {
    await test.step('Yeni Mono kişi oluştur', () => mono.createPerson(customer));
    await test.step('Aynı kişiyi özel tanımlı müşteri yap', () => mono.registerSpecialCustomer(customer));
    expect(customer.specialCustomerCreated).toBe(true);
  } finally {
    await testInfo.attach('test-musterisi', { body: JSON.stringify(customer), contentType: 'application/json' });
  }
});
