import { test, expect } from '../../fixtures/test.js';
import { LoginPage } from '../../pages/login.page.js';
import { MonoPage } from '../../pages/mono.page.js';
import { ShortTermPage } from '../../pages/short-term.page.js';
import { newTestCustomer, reservationDates } from '../../support/short-term-data.js';
import {
  assertStandardReservation,
  assertStandardReservationCreated,
} from '../../api/reservation.assertions.js';
import { RentalLifecycleFlow } from '../../flows/rental-lifecycle.flow.js';
import {
  createRentalLifecycleContext,
  lifecycleArtifact,
} from '../../support/rental-lifecycle-data.js';

test('Mono müşterisiyle kısa dönem kiralama tamamlanır @ui @write @lifecycle @short-term', async ({ page, env, credentials, writeAccess }, testInfo) => {
  void writeAccess;
  test.setTimeout(600000);
  if (env.shortTerm.startOffsetDays !== 0) {
    const setting = `${env.name.toUpperCase()}_SHORT_TERM_START_OFFSET_DAYS`;
    throw new Error(`${setting}=0 gerekli: bu test rezervasyonu bugün teslim edip iade eder.`);
  }
  const customer = newTestCustomer();
  const dates = reservationDates(env.shortTerm);
  const result = { saved: false };
  let lifecycleContext;
  const mono = new MonoPage(page);
  const reservation = new ShortTermPage(page, env);
  const login = new LoginPage(page);
  await login.login(credentials);
  try {
    await test.step('Mono kişisini oluştur', () => mono.createPerson(customer));
    await test.step('Özel tanımlı müşteri olarak ekle', () => mono.registerSpecialCustomer(customer));
    await test.step('Kısa dönem Yeni sayfasını aç', () => reservation.openNew());
    await test.step('Randevu tarih ve saatlerini gir', () => reservation.fillDates(dates));
    await test.step('Çankaya Next Level ve CDAD seç', () => reservation.selectOfficeAndGroup());
    await test.step('Oluşturulan müşteriyi seç, gerekiyorsa ehliyeti doldur', () => reservation.selectCustomerAndCheckLicense(customer));
    await test.step('Ödemeyi Sonra Al seç', () => reservation.payLater());
    await test.step('Eksikse fatura adresini oluştur ve seç', () => reservation.ensureBillingAddress(customer));
    const saved = await test.step('Rezervasyonu kaydet', () => reservation.save(result));
    await test.step('Rezervasyon oluşturma API yanıtını doğrula', () =>
      assertStandardReservationCreated(saved));
    if (env.name === 'validation') {
      await test.step('Validation kaydını API üzerinden ayrıntılı doğrula', () =>
        assertStandardReservation(page.request, { saved, customer, dates }));
    }
    expect(result.saved).toBe(true);
    lifecycleContext = createRentalLifecycleContext({
      saved,
      customer,
      reservationType: 'standard',
    });
    await test.step('Sözleşme, sıfır provizyon, teslim ve iadeyi tamamla', () =>
      new RentalLifecycleFlow(page, env).complete(lifecycleContext));
    expect(lifecycleContext.stage).toBe('completed');
    await test.step('Oturumu kapat', () => login.logout());
  } finally {
    await testInfo.attach('kisa-donem-kaydi', {
      body: JSON.stringify({
        environment: env.name,
        runId: customer.runId,
        dates,
        result: { id: result.id, code: result.code, saved: result.saved },
        lifecycle: lifecycleContext ? lifecycleArtifact(lifecycleContext) : null,
      }),
      contentType: 'application/json',
    });
  }
});
