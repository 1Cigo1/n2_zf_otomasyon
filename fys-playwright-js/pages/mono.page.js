import { expect } from '@playwright/test';
import { FormControls } from '../components/form.controls.js';

export class MonoPage {
  constructor(page) { this.page = page; }
  get dialog() { return this.page.locator('.v-dialog[role="dialog"]:visible').last(); }

  async createPerson(customer) {
    // Sol menü kullanıcı tercihine göre yalnız ikon veya tamamen daraltılmış
    // gelebilir. Test menü görünümünü değil Mono işlevini sınadığı için kararlı
    // uygulama rotasına doğrudan gider.
    await this.page.goto('/customer/customer-list');
    await expect(this.page).toHaveURL(/\/customer\/customer-list/);
    await expect(this.page.getByRole('heading', { name: 'Mono Listesi', exact: true })).toBeVisible();
    await this.page.getByRole('button', { name: /^Yeni$/i }).click();
    const modal = this.dialog.filter({ hasText: 'Yeni Mono Ekle' });
    await expect(modal).toBeVisible();
    const form = new FormControls(this.page, modal);
    await form.fill('Kimlik No', customer.identity);
    await modal.getByPlaceholder('İsim', { exact: true }).fill(customer.firstName);
    await modal.getByPlaceholder('Soyisim', { exact: true }).fill(customer.lastName);
    await modal.getByPlaceholder('Mono Tipi', { exact: true }).click();
    const monoTypeOption = this.page.getByRole('option');
    await monoTypeOption.first().click();
    await modal.getByPlaceholder('Mono Kaynağı', { exact: true }).click();
    await this.page.getByRole('option').first().click();
    await modal.getByPlaceholder('Doğum Tarihi', { exact: true }).fill(customer.birthDate);
    await modal.getByPlaceholder('Doğum Tarihi', { exact: true }).press('Tab');
    await modal.getByRole('textbox', { name: 'Arama yap' }).first().fill('tur');
    await this.page.getByText('+90', { exact: true }).click();
    await modal.getByPlaceholder('(999) 999 99 99', { exact: true }).fill(customer.phone);
    // Python sayfasında kullanılan e-posta satırının aynı kapsayıcısı.
    await modal.locator('.v-row.items-center > .v-col.v-col-6 input').first().fill(customer.email);
    await form.choose('İl', { text: customer.province });
    await form.choose('İlçe', { text: customer.district });
    await modal.locator('textarea').fill(customer.address);
    await form.button('Kaydet').click();
    const [response] = await Promise.all([
      this.page.waitForResponse(r => new URL(r.url()).pathname === '/api/customer/' && r.request().method() === 'POST', { timeout: 30000 }),
      this.page.getByRole('button', { name: /^Evet, Kaydet$/i }).click(),
    ]);
    expect(response.status(), 'Mono oluşturma API yanıtı').toBe(200);
    await expect(this.page.locator('.v-dialog[role="dialog"]:visible')).toHaveCount(0, { timeout: 30000 });
    customer.monoCreated = true;
  }

  async registerSpecialCustomer(customer) {
    await this.page.getByRole('link', { name: /Özel Tanımlı Müşteriler/ }).click();
    await expect(this.page).toHaveURL(/\/customer\/vip/);
    await expect(this.page.getByRole('heading', { name: 'Özel Tanımlı Müşteri Yönetimi', exact: true })).toBeVisible();
    await this.page.getByRole('button', { name: /^Yeni$/i }).click();
    await expect(this.dialog).toBeVisible();
    const input = this.dialog.getByRole('textbox', { name: 'Müşteriler Müşteriler', exact: true });
    // Açılır liste, kimlik aramasının API yanıtından sonra doluyor.
    // İlk açılıştaki genel müşteri listesini bu aramanın yanıtıyla karıştırma.
    const [searchResponse] = await Promise.all([
      this.page.waitForResponse(response => {
        const url = new URL(response.url());
        return url.pathname === '/api/customer/' &&
          response.request().method() === 'GET' &&
          url.searchParams.get('search') === customer.identity;
      }, { timeout: 60000 }),
      input.fill(customer.identity),
    ]);
    expect(searchResponse.status(), 'Özel müşteri arama API yanıtı').toBe(200);
    const option = this.page.getByRole('option', {
      name: `${customer.firstName} ${customer.lastName}`, exact: true,
    });
    await expect(option).toHaveCount(1);
    await option.click();
    await input.press('Tab');
    const [response] = await Promise.all([
      this.page.waitForResponse(r => new URL(r.url()).pathname === '/api/customer-partner/extra/add-vip-customers/' && r.request().method() === 'POST', { timeout: 30000 }),
      this.dialog.getByRole('button', { name: /^Kaydet$/i }).click(),
    ]);
    expect(response.status(), 'Özel tanımlı müşteri API yanıtı').toBe(200);
    await expect(this.page.locator('.v-dialog[role="dialog"]:visible')).toHaveCount(0, { timeout: 30000 });
    customer.specialCustomerCreated = true;
  }
}
