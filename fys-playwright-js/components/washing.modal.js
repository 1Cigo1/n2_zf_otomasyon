import { expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { parseKm, nextKm, plateOf } from '../support/values.js';

const photos = {
  'Sol Ön': 'front-left.jpg', 'Ön': 'front.jpg', 'Sağ Ön': 'front-right.jpg',
  'Sol Arka': 'rear-left.jpg', 'Arka': 'rear.jpg', 'Sağ Arka': 'rear-right.jpg',
};
const exact = text => new RegExp(`^${text}$`, 'i');

export class WashingModal {
  constructor(page, env) { this.page = page; this.env = env; }
  get dialog() { return this.page.locator('.v-dialog[role="dialog"]:visible').last(); }
  field(label) {
    // Vuetify aynı input için normal + floating label üretebiliyor.
    const byLabel = this.dialog.getByLabel(label, { exact: true });
    const byVisibleLabel = this.dialog.locator('.v-input').filter({
      has: this.page.locator('label').filter({ hasText: exact(label) }),
    }).locator('input');
    return byLabel.or(byVisibleLabel).first();
  }
  button(label) { return this.dialog.getByRole('button', { name: exact(label) }); }
  async hasField(label) { return this.field(label).isVisible(); }
  async open() { await expect(this.dialog).toBeVisible(); }

  async select(label, preferred = '', excluded = new Set()) {
    const input = this.field(label);
    await input.locator('..').click();
    await input.press('ArrowDown');
    const options = this.page.locator('.v-overlay--active [role="listbox"] [role="option"]:visible');
    await expect(options.first()).toBeVisible();
    const texts = (await options.allInnerTexts()).map(text => text.trim());
    const indexes = texts.map((text, i) => ({ text, i })).filter(({ text }) =>
      !excluded.has(text) && (!preferred || text === preferred || (label === 'Araç' && plateOf(text) === preferred)));
    if (!indexes.length) throw new Error(`${label}: uygun seçenek bulunamadı (${preferred || 'rastgele seçim'}).`);
    const selected = indexes[Math.floor(Math.random() * indexes.length)];
    await options.nth(selected.i).click();
    return selected.text;
  }

  async uploadPhotos() {
    for (const [label, filename] of Object.entries(photos)) {
      const input = this.field(label);
      await expect(input).toBeAttached();
      await input.setInputFiles(fileURLToPath(new URL(`../test-data/photos/${filename}`, import.meta.url)));
      await expect.poll(() => input.evaluate(el => el.files?.length || 0)).toBe(1);
    }
    // Bekleme üst sınırdır; yükleme biter bitmez devam eder.
    await expect(this.dialog.locator('button[aria-busy="true"], button.v-btn--loading')).toHaveCount(0, {
      timeout: this.env.actionTimeout,
    });
  }

  async description(text) {
    const editor = this.dialog.locator('.ql-editor');
    if (await editor.count()) await editor.fill(text);
  }

  async createRequest(context) {
    await this.open();
    const attempted = new Set();
    for (let attempt = 0; attempt < 5; attempt++) {
      const vehicle = await this.select('Araç', this.env.vehiclePlate, attempted);
      attempted.add(vehicle);
      try {
        await expect.poll(() => this.dialog.locator('input[type="file"]').count(), {
          timeout: 8000,
        }).toBeGreaterThanOrEqual(6);
      } catch {
        // Ortama göre ekstra resim alanı bulunmayabilir; altı etiket yeterlidir.
        if (await this.dialog.locator('input[type="file"]').count() < 6) {
          if (this.env.vehiclePlate) throw new Error('Seçilen test aracında fotoğraf alanları açılmadı.');
          continue;
        }
      }
      context.plate = plateOf(vehicle);
      context.vehicle = vehicle;
      break;
    }
    if (!context.plate) throw new Error('5 araç denemesinde fotoğraf formu açılamadı.');
    // Araç bu noktadan sonra kilitlenir; hata olursa farklı araca geçilmez.
    await this.uploadPhotos();
    await this.description(context.description);
    await this.submit('Kaydet');
  }

  async vehicleCondition(context) {
    const heading = this.dialog.getByRole('heading', { name: 'Kilometre', exact: true });
    const current = parseKm(await heading.locator('xpath=following-sibling::*[1]').innerText());
    context.km = nextKm(current, context.km);
    // Fotoğraf seçimi bileşeni yeniden çizebildiği için sayısal alanlar en son.
    await this.uploadPhotos();
    await this.field('Aracın KM').fill(String(context.km));
    await this.field('Aracın KM').press('Tab');
    const fuel = this.field('Yakıt Miktarı')
      .or(this.field('Yakıt Miktarı Yakıt Miktarı ')).first();
    await fuel.fill('4');
    await fuel.press('Tab');
    await expect(this.field('Aracın KM')).toHaveValue(String(context.km));
    await expect(fuel).toHaveValue('4');
  }

  async appointment() {
    await this.field('Randevu Tarihi').locator('..').click();
    const calendar = this.page.locator('.p-datepicker:visible');
    const today = calendar.locator('.p-datepicker-day[data-p~="today"][aria-disabled="false"]');
    await expect(today).toHaveCount(1);
    await today.click();
    await this.field('Randevu Tarihi').press('Tab');
  }

  async fillCurrentStep(context) {
    await this.open();
    // Diyalog kabuğu alanlardan önce geliyor; boş kabuğu tamamlanmış adım sanma.
    await expect.poll(async () => {
      for (const label of ['Aracın KM', 'Servis Noktası', 'Personel Ataması', 'Teslim Yapacak Kişi', 'Mono', 'Randevu Tarihi']) {
        if (await this.hasField(label)) return true;
      }
      return false;
    }, { timeout: this.env.actionTimeout }).toBe(true);
    // Her modal için açık fonksiyon çağrısı; aynı modalda birden fazla alan işlenir.
    for (const label of ['Servis Noktası', 'Personel Ataması', 'Teslim Yapacak Kişi', 'Mono']) {
      if (await this.hasField(label)) await this.select(label, this.env.choices[label]);
    }
    if (await this.hasField('Randevu Tarihi')) await this.appointment();
    await this.description(context.description);
    if (await this.hasField('Aracın KM')) await this.vehicleCondition(context);

    if (await this.hasField('Aracın KM')) {
      await expect(this.field('Aracın KM')).toHaveValue(String(context.km));
      const fuel = this.field('Yakıt Miktarı')
        .or(this.field('Yakıt Miktarı Yakıt Miktarı ')).first();
      await expect(fuel).toHaveValue('4');
    }

    for (const action of ['Kapat', 'Onayla', 'İlerlet']) {
      if (await this.button(action).isVisible()) {
        await this.submit(action);
        if (action === 'Kapat') context.closed = true;
        return;
      }
    }
    throw new Error('Tanınmayan yıkama modalı: İlerlet/Onayla/Kapat düğmesi yok.');
  }

  async submit(action) {
    const original = await this.dialog.elementHandle();
    const messages = new Set();
    try {
      const button = this.button(action);
      await expect(button).toBeEnabled();
      await expect(button).not.toHaveAttribute('aria-busy', 'true');
      await button.click();
      await expect.poll(async () => {
        const errors = await this.page.locator(
          '.v-input--error .v-messages__message:visible, .p-toast-message-error:visible, ' +
          '.v-alert.text-error:visible, .v-alert.bg-error:visible, .v-snackbar__content:visible',
        ).allInnerTexts();
        errors.forEach(text => messages.add(text.trim()));
        const invalidLabels = await this.dialog.locator('.v-input--error label').allTextContents();
        invalidLabels.forEach(text => messages.add(`Geçersiz alan: ${text.trim()}`));
        return original.isVisible();
      }, { timeout: this.env.saveTimeout, intervals: [100, 200, 400] }).toBe(false);
    } catch (error) {
      throw new Error(`${action}: modal kapanmadı. ${[...messages].join(' | ') || 'Bildirim yok.'}`, { cause: error });
    } finally { await original.dispose(); }
  }
}
