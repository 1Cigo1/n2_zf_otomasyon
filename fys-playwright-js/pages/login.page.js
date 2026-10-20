import { expect } from '@playwright/test';

export class LoginPage {
  constructor(page) {
    this.page = page;
    this.email = page.getByRole('textbox', { name: 'E-posta adresinizi giriniz' });
    this.password = page.getByRole('textbox', { name: 'Parolanızı giriniz' });
    this.submit = page.getByRole('button', { name: /^Giriş Yap$/i });
  }

  async login(credentials) {
    await this.page.goto('/auth/login');
    await this.email.fill(credentials.email);
    await this.password.fill(credentials.password);
    await Promise.all([
      this.page.waitForURL(
        url => !url.pathname.startsWith('/auth/login'),
        { timeout: Number(process.env.LOGIN_TIMEOUT_MS || 30000) },
      ),
      this.submit.click(),
    ]);
    await expect(this.page).not.toHaveURL(/\/auth\/login/, {
      timeout: Number(process.env.LOGIN_TIMEOUT_MS || 30000),
    });
    await expect(this.page.locator('header, .v-toolbar').first()).toBeVisible();
  }

  async logout() {
    await expect(this.page.locator('.v-dialog[role="dialog"]:visible')).toHaveCount(0);
    await expect(this.page.locator('.v-overlay__scrim:visible')).toHaveCount(0);
    // Kullanıcı adına bağlı olmadan mevcut üst menünün profil düğmesi.
    await this.page.locator('header button, .v-toolbar button').last().click();
    await this.page.locator('.v-overlay--active').getByText('Oturumu Kapat', { exact: true }).click();
    await expect(this.page).toHaveURL(/\/auth\/login/);
    await expect(this.email).toBeVisible();
  }
}
