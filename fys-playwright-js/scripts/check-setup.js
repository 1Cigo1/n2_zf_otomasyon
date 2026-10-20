import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Testlerle aynı .env dosyasını oku. Değerleri ekrana yazdırma.
const envFile = fileURLToPath(new URL('../.env', import.meta.url));
dotenv.config({ path: envFile, quiet: true });

function hasValue(name) {
  return String(process.env[name] || '').trim().length > 0;
}

function showStatus(title, requiredNames) {
  const missing = requiredNames.filter((name) => !hasValue(name));
  if (missing.length === 0) {
    console.log(`${title}: hazır`);
    return;
  }
  console.log(`${title}: eksik: ${missing.join(', ')}`);
}

console.log(`Ayar dosyası: ${envFile}`);
if (!existsSync(envFile)) console.log('.env bulunamadı; .env.example dosyasını kopyalayın.');
showStatus('Validation giriş', ['VALIDATION_EMAIL', 'VALIDATION_PASSWORD']);
showStatus('Dev giriş', ['DEV_EMAIL', 'DEV_PASSWORD']);
showStatus('Broker GET', ['BROKER_TOKEN', 'BROKER_COMPANY_ID', 'BROKER_APPLICATION_ID']);

const bookingNames = [
  'BROKER_TOKEN', 'BROKER_COMPANY_ID', 'BROKER_APPLICATION_ID',
  'BROKER_TEST_NAME', 'BROKER_TEST_SURNAME', 'BROKER_TEST_MOBILE_PHONE',
  'BROKER_TEST_EMAIL',
];
const missingBooking = bookingNames.filter((name) => !hasValue(name));
const generatesRentalId = process.env.BROKER_GENERATE_RENTAL_ID?.trim().toLowerCase() === 'true';
if (!generatesRentalId && !hasValue('BROKER_TEST_RENTAL_ID')) {
  missingBooking.push('BROKER_GENERATE_RENTAL_ID=true veya BROKER_TEST_RENTAL_ID');
}
if (missingBooking.length === 0) {
  console.log('Broker kayıt: hazır');
} else {
  console.log(`Broker kayıt: eksik: ${missingBooking.join(', ')}`);
}
console.log('Hazır, yalnız ayarların dolu olduğu anlamına gelir; API sonucunu doğrulamaz.');
console.log('Bu kontrol değerleri ve tokenı göstermez.');
