import { test, expect } from '../../fixtures/test.js';
import { requireCorporateConfig } from '../../config/environments.js';
import { LoginPage } from '../../pages/login.page.js';
import { CorporateShortTermPage } from '../../pages/corporate-short-term.page.js';
import {
  corporateCustomer,
  corporateReservationPeriod,
  maskIdentifier,
} from '../../support/corporate-short-term-data.js';
import {
  assertCorporateReservationCreated,
} from '../../api/reservation.assertions.js';
import { RentalLifecycleFlow } from '../../flows/rental-lifecycle.flow.js';
import {
  createRentalLifecycleContext,
  lifecycleArtifact,
} from '../../support/rental-lifecycle-data.js';

test(
  'Sözleşme numarasıyla kurumsal kısa dönem kiralama tamamlanır @ui @write @lifecycle @reservation @corporate',
  async ({ page, env, credentials, writeAccess }, testInfo) => {
    void writeAccess;
    test.setTimeout(600000);
    requireCorporateConfig(env);

    const config = env.corporateShortTerm;
    const customer = corporateCustomer(config);
    const period = corporateReservationPeriod(config);
    const result = { saved: false };
    let selectedServices = [];
    let lifecycleContext;

    const login = new LoginPage(page);
    const reservation = new CorporateShortTermPage(page, env);

    await test.step('UI üzerinden giriş yap', () => login.login(credentials));

    try {
      await test.step('Kurumsal kısa dönem sözleşme listesini aç', () =>
        reservation.openContractList());
      await test.step('Sözleşme numarasıyla doğru satırı seç', () =>
        reservation.selectContract(config.contractNumber));
      await test.step('Rezervasyon formunu aç', () =>
        reservation.startReservation());
      await test.step('Rezervasyon bitiş tarihini doldur', () =>
        reservation.fillEndDate(period.end));
      await test.step('Çankaya Next Level ve CDAD seç', () =>
        reservation.selectOfficeAndGroup());
      await test.step('Ortam müşterisini seç ve gerekiyorsa ehliyeti doldur', () =>
        reservation.selectCustomer(customer));
      await test.step('Kurumsal fatura tipini seç', () =>
        reservation.selectInvoiceType());
      selectedServices = await test.step(
        'Dönemlere göre Ek Sürücü dışındaki hizmetleri seç',
        () => reservation.selectAdditionalServices(),
      );
      await test.step('Eksikse fatura adresini oluştur ve seç', () =>
        reservation.ensureBillingAddress(customer));

      const saved = await test.step('Kurumsal rezervasyonu bir kez kaydet', () =>
        reservation.save());
      Object.assign(result, saved, { saved: true });

      await test.step('Kurumsal kayıt API yanıtını doğrula', () =>
        assertCorporateReservationCreated(saved));
      expect(result.saved).toBe(true);
      lifecycleContext = createRentalLifecycleContext({
        saved,
        customer,
        reservationType: 'corporate',
      });
      await test.step('Sözleşme, teslim ve iadeyi provizyonsuz tamamla', () =>
        new RentalLifecycleFlow(page, env).complete(lifecycleContext));
      expect(lifecycleContext.stage).toBe('completed');
      await test.step('Oturumu kapat', () => login.logout());
    } finally {
      await testInfo.attach('kurumsal-kisa-donem-kaydi', {
        body: JSON.stringify({
          environment: env.name,
          contract: maskIdentifier(config.contractNumber),
          customer: maskIdentifier(customer.identity),
          period,
          selectedServices,
          result: {
            id: result.id,
            code: result.code,
            saved: result.saved,
          },
          lifecycle: lifecycleContext ? lifecycleArtifact(lifecycleContext) : null,
        }),
        contentType: 'application/json',
      });
    }
  },
);
