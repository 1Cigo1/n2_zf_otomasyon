import { test, expect } from '../../fixtures/test.js';
import { LoginPage } from '../../pages/login.page.js';

test('Kullanıcı giriş ve çıkış yapar @login @smoke', async ({ page, credentials }) => {
  const login = new LoginPage(page);
  await login.login(credentials);
  await login.logout();
  await page.goto('/demand/list/standart_yikama?workflow_key=standart_yikama');
  await expect(page).toHaveURL(/\/auth\/login/);
});
