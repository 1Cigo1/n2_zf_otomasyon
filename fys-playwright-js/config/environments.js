import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

export function environments(value = process.env.TEST_ENV || 'validation') {
  if (value === 'all') return ['validation', 'dev'];
  if (!['validation', 'dev'].includes(value)) throw new Error(`Geçersiz TEST_ENV: ${value}`);
  return [value];
}

export function environment(name, activeRole = 'short') {
  environments(name);
  if (name === 'all') throw new Error('Tek bir ortam seçilmeli.');
  if (!['short', 'long'].includes(activeRole)) throw new Error('ACTIVE_ROLE short veya long olmalı.');
  const prefix = name.toUpperCase();
  const value = key => process.env[`${prefix}_${key}`];
  const baseURL = value('BASE_URL') || (name === 'validation'
    ? 'https://fys-validation.n2mobil.co' : 'https://dev-fys.n2mobil.co');
  const workflowKey = value('WORKFLOW_KEY') || 'standart_yikama';
  if (!['standart_yikama', 'kiralama_donusu_yikama'].includes(workflowKey)) {
    throw new Error(`Desteklenmeyen yıkama workflow: ${workflowKey}`);
  }
  const returnKmIncrement = Number(value('RETURN_KM_INCREMENT') || 30);
  const returnFuel = Number(value('RETURN_FUEL') || 2);
  const monthlyPeriodCount = Number(value('MONTHLY_PERIOD_COUNT') || 2);
  if (!Number.isInteger(returnKmIncrement) || returnKmIncrement < 0) {
    throw new Error(`${prefix}_RETURN_KM_INCREMENT sıfır veya pozitif tam sayı olmalı.`);
  }
  if (!Number.isInteger(returnFuel) || returnFuel < 0 || returnFuel > 8) {
    throw new Error(`${prefix}_RETURN_FUEL 0 ile 8 arasında tam sayı olmalı.`);
  }
  if (!Number.isInteger(monthlyPeriodCount) || monthlyPeriodCount < 1) {
    throw new Error(`${prefix}_MONTHLY_PERIOD_COUNT pozitif tam sayı olmalı.`);
  }
  return {
    name, baseURL, workflowKey, activeRole,
    email: activeRole === 'long' ? process.env[`LONG_${prefix}_EMAIL`] : value('EMAIL'),
    password: activeRole === 'long'
      ? process.env[`${prefix}_USER_PASSWORD`] || value('PASSWORD')
      : value('PASSWORD') || process.env[`${prefix}_USER_PASSWORD`],
    vehiclePlate: value('VEHICLE_PLATE') || '',
    longTerm: {
      customerName: value('E2E_CUSTOMER_NAME') || '',
      vehicleGroup: process.env.E2E_VEHICLE_GROUP || '',
    },
    monthly: {
      customerIdentityNo: value('MONTHLY_CUSTOMER_IDENTITY_NO') || '',
      periodCount: monthlyPeriodCount,
      customer: {
        identity: value('MONTHLY_CUSTOMER_IDENTITY_NO') || '',
        firstName: value('MONTHLY_CUSTOMER_FIRST_NAME') || '',
        lastName: value('MONTHLY_CUSTOMER_LAST_NAME') || '',
        email: value('MONTHLY_CUSTOMER_EMAIL') || '',
        phone: value('MONTHLY_CUSTOMER_PHONE') || '',
        country: value('MONTHLY_CUSTOMER_COUNTRY') || 'Turkey',
        province: value('MONTHLY_CUSTOMER_PROVINCE') || 'Ankara',
        district: value('MONTHLY_CUSTOMER_DISTRICT') || 'Yenimahalle',
        address: value('MONTHLY_CUSTOMER_ADDRESS') || '',
        licenseNumber: value('MONTHLY_CUSTOMER_LICENSE_NUMBER') || '',
        licenseDate: value('MONTHLY_CUSTOMER_LICENSE_DATE') || '',
      },
    },
    shortTerm: {
      startOffsetDays: Number(value('SHORT_TERM_START_OFFSET_DAYS') || 0),
      durationDays: Number(value('SHORT_TERM_DURATION_DAYS') || 7),
    },
    corporateShortTerm: {
      contractNumber: value('CORPORATE_CONTRACT_NUMBER') || '',
      customerIdentity: value('CORPORATE_CUSTOMER_IDENTITY') || '',
      customerFirstName: value('CORPORATE_CUSTOMER_FIRST_NAME') || '',
      customerLastName: value('CORPORATE_CUSTOMER_LAST_NAME') || '',
      customerEmail: value('CORPORATE_CUSTOMER_EMAIL') || '',
      customerPhone: value('CORPORATE_CUSTOMER_PHONE') || '',
      customerCountry: value('CORPORATE_CUSTOMER_COUNTRY') || 'Turkey',
      customerProvince: value('CORPORATE_CUSTOMER_PROVINCE') || 'Ankara',
      customerDistrict: value('CORPORATE_CUSTOMER_DISTRICT') || 'Yenimahalle',
      customerAddress: value('CORPORATE_CUSTOMER_ADDRESS') || '',
      customerLicenseNumber: value('CORPORATE_CUSTOMER_LICENSE_NUMBER') || '',
      customerLicenseDate: value('CORPORATE_CUSTOMER_LICENSE_DATE') || '',
      invoiceType: value('CORPORATE_INVOICE_TYPE') || 'Full credit',
      additionalService: value('CORPORATE_ADDITIONAL_SERVICE') || '',
      // Birden fazla aylık dönem ve "Aylık Özelleştir" alanı oluşsun.
      durationDays: Number(value('CORPORATE_DURATION_DAYS') || 45),
    },
    rentalLifecycle: {
      // İş kuralı: standart kısa dönemde sıfır provizyon, kurumsalda provizyon yok.
      standardProvisionAmount: value('PROVISION_AMOUNT') || '0',
      returnKmIncrement,
      returnFuel: String(returnFuel),
      deliveryDamage: 'Aracın teslim sırasında yeni hasarı yoktur.',
      returnDamage: 'Aracın iade sırasında yeni hasarı yoktur.',
    },
    choices: {
      'Mono': value('MONO'), 'Servis Noktası': value('SERVICE_POINT'),
      'Personel Ataması': value('PERSONNEL'), 'Teslim Yapacak Kişi': value('DELIVERY_PERSON'),
    },
    actionTimeout: Number(process.env.ACTION_TIMEOUT_MS || 15000),
    saveTimeout: Number(process.env.SAVE_TIMEOUT_MS || 30000),
  };
}

export function requireCredentials(config) {
  if (!config.email || !config.password) {
    const prefix = config.name.toUpperCase();
    const emailName = config.activeRole === 'long' ? `LONG_${prefix}_EMAIL` : `${prefix}_EMAIL`;
    throw new Error(`${emailName} ve ${prefix}_PASSWORD (veya ${prefix}_USER_PASSWORD) tanımlanmalı.`);
  }
}

export function requireCorporateConfig(config) {
  const required = {
    [`${config.name.toUpperCase()}_CORPORATE_CONTRACT_NUMBER`]:
      config.corporateShortTerm.contractNumber,
    [`${config.name.toUpperCase()}_CORPORATE_CUSTOMER_IDENTITY`]:
      config.corporateShortTerm.customerIdentity,
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length) {
    throw new Error(`Kurumsal kısa dönem ayarları eksik: ${missing.join(', ')}`);
  }
}

export function requireWriteAccess(config) {
  if (!['1', 'true', 'yes', 'on'].includes(
    String(process.env.ALLOW_WRITE_TESTS || '').toLowerCase(),
  )) {
    throw new Error('Kayıt oluşturan test için ALLOW_WRITE_TESTS=true gerekli.');
  }
  const allowedHosts = new Set([
    'dev-fys.n2mobil.co',
    'fys-validation.n2mobil.co',
  ]);
  const host = new URL(config.baseURL).hostname;
  if (!allowedHosts.has(host)) {
    throw new Error(`Yazma testi bu host üzerinde çalıştırılamaz: ${host}`);
  }
}
