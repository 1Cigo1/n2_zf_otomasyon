import { test, expect } from '../../fixtures/test.js';
import { LoginPage } from '../../pages/login.page.js';
import { FaytPage } from '../../pages/fayt-workflow.page.js';

test('FAYT araç bakım talebi oluşturulur @ui @write @fayt-maintenance',
  async ({ page, env, credentials, writeAccess }) => {
    void writeAccess;
    test.setTimeout(300000);
    await test.step('Giriş yap', () => new LoginPage(page).login(credentials));
    await test.step('FAYT menüsünü aç', () => page.getByTitle('Filo Araçları Yönetim').click());
    const result = await test.step('Bakım talebini oluştur ve ilerlet', () =>
      new FaytPage(page, env).run('arac_bakim'));
    expect(result.selectedPlate).toBeTruthy();
  });
