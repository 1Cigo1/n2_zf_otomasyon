import { test } from '../../fixtures/test.js';
import { LoginPage } from '../../pages/login.page.js';
import { LongTermPage } from '../../pages/long-term.page.js';

test('Uzun dönem sözleşme, grup ve araç oluşturulur @ui @write @long-term',
  async ({ page, env, credentials, writeAccess }) => {
    void writeAccess;
    test.setTimeout(300000);
    if (!env.longTerm.customerName || !env.longTerm.vehicleGroup) {
      throw new Error('E2E_CUSTOMER_NAME ve E2E_VEHICLE_GROUP gerekli.');
    }
    const login = new LoginPage(page);
    const flow = new LongTermPage(page);
    await test.step('Uzun dönem hesabıyla giriş yap', () => login.login(credentials));
    await test.step('Uzun dönem menüsünü aç', () => flow.open());
    await test.step('Sözleşme oluştur', () => flow.createContract(env.longTerm.customerName));
    await test.step('Müşteri sözleşmesini aç', () => flow.openContract(env.longTerm.customerName));
    await test.step('Araç grubu oluştur', () => flow.addVehicleGroup(env.longTerm.vehicleGroup));
    await test.step('Gruba araç ekle', () => flow.addVehicle(env.longTerm.vehicleGroup));
    await test.step('Oturumu kapat', () => login.logout());
  });
