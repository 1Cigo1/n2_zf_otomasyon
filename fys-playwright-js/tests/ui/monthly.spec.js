import { test, expect } from '../../fixtures/test.js';
import { LoginPage } from '../../pages/login.page.js';
import { MonthlyPage } from '../../pages/monthly.page.js';

test('Aylık rezervasyon oluşturulur @ui @write @monthly',
  async ({ page, env, credentials, writeAccess }) => {
    void writeAccess;
    test.setTimeout(300000);
    const login = new LoginPage(page);
    const monthly = new MonthlyPage(page, env);
    await test.step('Giriş yap', () => login.login(credentials));
    await test.step('Yeni aylık rezervasyon aç', () => monthly.open());
    await test.step('İki aylık tarihi seç', () => monthly.chooseDates());
    const office = 'Ankara Çankaya (Next Level AVM)';
    await test.step('Ofis, marka ve modeli seç', async () => {
      await monthly.chooseField('Teslim Alma Ofisi', office);
      await monthly.chooseField('Teslim Etme Ofisi', office);
      await monthly.chooseField('Marka', 'SKODA');
      await monthly.chooseField('Model', 'SUPERB');
    });
    const plate = await test.step('Müsait araç seç', () => monthly.chooseVehicle());
    expect(plate).toBeTruthy();
    await test.step('Müşteriyi seç, gerekiyorsa ehliyeti kaydet', () => monthly.chooseCustomer());
    const service = await test.step('Ek Sürücü dışı hizmet seç', () => monthly.chooseAdditionalService());
    expect(service).toBeTruthy();
    await test.step('Gerekiyorsa fatura adresini tamamla', () => monthly.ensureBillingAddress());
    await test.step('Rezervasyonları oluştur', () => monthly.save());
  });
