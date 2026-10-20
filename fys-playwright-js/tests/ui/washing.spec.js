import { test, expect } from '../../fixtures/test.js';
import { LoginPage } from '../../pages/login.page.js';
import { WashingPage } from '../../pages/washing.page.js';

test('Login → yıkama talebi → kapat → logout @washing @ui @write', async ({ page, env, credentials, writeAccess }, testInfo) => {
  void writeAccess;
  const login = new LoginPage(page);
  const context = { plate: '', code: '', km: 0, closed: false,
    description: `E2E ${env.name} ${Date.now()}` };
  await test.step('Kullanıcı arayüzden giriş yapar', () => login.login(credentials));
  try {
    await test.step('Workflow açılır, talep oluşturulur ve kapatılır', async () => {
      await new WashingPage(page, env).complete(context);
      expect(context.closed).toBe(true);
    });
  } finally {
    await testInfo.attach('talep-bilgisi', { body: JSON.stringify({
      environment: env.name, plate: context.plate, code: context.code,
      closed: context.closed, description: context.description,
    }), contentType: 'application/json' });
  }
  // Başarısız talebi otomatik kapatmaz; inceleme için raporda kodu bulunur.
  await test.step('Kullanıcı oturumunu kapatır', () => login.logout());
});
