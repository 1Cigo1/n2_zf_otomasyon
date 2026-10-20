import { FormControls } from '../form.controls.js';

const requiredFields = [
  'identity', 'firstName', 'lastName', 'email', 'phone',
  'province', 'district', 'address',
];

export class BillingAddressModal {
  constructor(page) {
    this.page = page;
  }

  get dialog() {
    return this.page.locator('.v-dialog[role="dialog"]:visible').last();
  }

  async fill(customer) {
    const missing = requiredFields.filter(field => !customer[field]);
    if (missing.length) {
      throw new Error(
        `Fatura adresi modalı açıldı fakat müşteri verileri eksik: ${missing.join(', ')}`,
      );
    }

    const form = new FormControls(this.page, this.dialog);
    await form.fill('İsim', customer.firstName);
    await form.fill('Soyisim', customer.lastName);
    await form.fill('Kimlik No', customer.identity);
    await form.fill('E-Posta', customer.email);
    await form.fill('Telefon', customer.phone);
    await form.choose('İl', { text: customer.province });
    await form.choose('İlçe', { text: customer.district });
    await form.fill('Adres', customer.address);
    await form.button('Kaydet').click();
    await this.page.getByRole('button', { name: /^Evet, Kaydet$/i }).click();
    await this.page.getByRole('button', { name: /^Adresi Seç$/i }).click();
  }
}
