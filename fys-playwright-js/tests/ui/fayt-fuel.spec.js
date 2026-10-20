import { test, expect } from '../../fixtures/test.js';
import { LoginPage } from '../../pages/login.page.js';
import { FaytPage } from '../../pages/fayt-workflow.page.js';

test('FAYT kiralama dönüşü yakıt talebi kapatılır @ui @write @fayt-fuel',
  async ({ page, env, credentials, writeAccess }) => {
    void writeAccess;
    test.setTimeout(300000);
    await test.step('Giriş yap', () => new LoginPage(page).login(credentials));
    await test.step('FAYT menüsünü aç', () => page.getByTitle('Filo Araçları Yönetim').click());
    const result = await test.step('Yakıt talebini oluştur ve kapat', () =>
      new FaytPage(page, env).run('kiralama_donusu_yakit_alma'));
    expect(result.selectedPlate).toBeTruthy();
    expect(result.values.fuel_close_filled).toBe('true');
    expect(result.requestClosed).toBe(true);
  });
