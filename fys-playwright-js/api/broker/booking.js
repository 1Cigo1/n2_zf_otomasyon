import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fieldText } from './xml.js';

export const AVAILABLE_PATH = '/api/broker-service/booking/';
export const SAVE_PATH = '/api/broker-service/booking-save/';
export const CANCEL_PATH = '/api/broker-service/booking_cancel/';

const DEFAULT_OFFICE_ID = 'a4998532-0bed-4c4a-8fec-54f1cbb8a7c1';
export const LATEST_BOOKING = path.resolve('reports/api_bookings/son_rezervasyon.json');
export const CI_CANCEL_RECEIPT = path.resolve('reports/api_bookings/ci_cancel_receipt.json');

function positiveNumber(env, name, fallback) {
  const value = String(env[name] ?? fallback).trim();
  assert.match(value, /^[0-9]+$/, `${name} pozitif sayı olmalı.`);
  assert.ok(Number(value) > 0, `${name} pozitif sayı olmalı.`);
  return Number(value);
}

function istanbulDateParts(now) {
  // Arama günü Türkiye saatine göre hesaplanır; makinenin saat dilimine bağlı kalmaz.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const read = (type) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read('year'), month: read('month'), day: read('day') };
}

function addDays(dateParts, days) {
  const date = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function searchParams(now = new Date(), env = process.env) {
  const pickup = addDays(istanbulDateParts(now), positiveNumber(env, 'BROKER_DAYS_AHEAD', 7));
  const dropoff = addDays(pickup, positiveNumber(env, 'BROKER_RENTAL_DAYS', 2));
  const pickupId = env.BROKER_PICKUP_ID?.trim() || DEFAULT_OFFICE_ID;
  const currency = (env.BROKER_CURRENCY?.trim() || 'TRY').toUpperCase();
  assert.ok(['TRY', 'EUR', 'USD', 'GBP'].includes(currency), 'BROKER_CURRENCY geçersiz.');
  const hour = env.BROKER_HOUR?.trim() || '10';
  assert.match(hour, /^[0-9]+$/, 'BROKER_HOUR 0-23 olmalı.');
  assert.ok(Number(hour) <= 23, 'BROKER_HOUR 0-23 olmalı.');

  return {
    Currency: currency,
    Pickup_ID: pickupId,
    Pickup_Day: String(pickup.day),
    Pickup_Month: String(pickup.month),
    Pickup_Year: String(pickup.year),
    Pickup_Hour: hour,
    Pickup_Min: '00',
    Drop_Off_ID: env.BROKER_DROP_OFF_ID?.trim() || pickupId,
    Drop_Off_Day: String(dropoff.day),
    Drop_Off_Month: String(dropoff.month),
    Drop_Off_Year: String(dropoff.year),
    Drop_Off_Hour: hour,
    Drop_Off_Min: '00',
  };
}

export function firstBookableCar(cars) {
  const car = cars.find((item) => fieldText(item, 'Rez_ID') && fieldText(item, 'Group_ID'));
  assert.ok(car, 'Müsait araçlarda Rez_ID ve Group_ID birlikte bulunamadı.');
  return car;
}

export function customerFromEnv(env = process.env) {
  const requiredNames = [
    'BROKER_TEST_NAME',
    'BROKER_TEST_SURNAME',
    'BROKER_TEST_MOBILE_PHONE',
    'BROKER_TEST_EMAIL',
  ];
  const missing = requiredNames.filter((name) => !env[name]?.trim());
  assert.deepEqual(missing, [], `POST için test müşteri ayarı eksik: ${missing.join(', ')}`);

  // Solda API'nin beklediği parametre, sağda .env içindeki test bilgisi var.
  const customer = {
    Name: env.BROKER_TEST_NAME.trim(),
    SurName: env.BROKER_TEST_SURNAME.trim(),
    MobilePhone: env.BROKER_TEST_MOBILE_PHONE.trim(),
    Mail_Adress: env.BROKER_TEST_EMAIL.trim(),
  };
  const generated = env.BROKER_GENERATE_RENTAL_ID?.trim().toLowerCase() === 'true';
  if (generated) {
    customer.Rental_ID = `T${String(randomInt(100_000_000)).padStart(8, '0')}`;
  } else {
    customer.Rental_ID = env.BROKER_TEST_RENTAL_ID?.trim() || '';
    assert.ok(customer.Rental_ID, 'POST için BROKER_TEST_RENTAL_ID gerekli.');
  }
  return { customer, generated };
}

export function saveParams(search, car, customer, env = process.env) {
  // GET ile POST aynı tarih/ofis parametrelerini kullanır.
  const params = {
    ...search,
    Rez_ID: fieldText(car, 'Rez_ID'),
    Group_ID: fieldText(car, 'Group_ID'),
    Rental_ID: customer.Rental_ID,
    Name: customer.Name,
    SurName: customer.SurName,
    MobilePhone: customer.MobilePhone,
    Mail_Adress: customer.Mail_Adress,
    Ecop_ID: env.BROKER_ECOP_ID?.trim() || 'Korall55',
  };
  if (env.BROKER_FULL_CREDIT?.trim().toLowerCase() === 'true') params.Full_Credit = 'TRUE';
  return params;
}

async function writePrivateJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await chmod(filePath, 0o600);
  return filePath;
}

export async function writeBookingReceipt(receipt, updateLatest = false) {
  const safeId = receipt.Rez_ID.replace(/[^A-Za-z0-9_-]/g, '_');
  const specificPath = path.resolve('reports/api_bookings', `${safeId}.json`);
  await writePrivateJson(specificPath, receipt);
  if (updateLatest) return writePrivateJson(LATEST_BOOKING, receipt);
  return specificPath;
}

export async function readLatestBooking() {
  return JSON.parse(await readFile(LATEST_BOOKING, 'utf8'));
}

export async function exportCiCancelReceipt(receipt) {
  assert.equal(receipt.state, 'save_xml_key_status_matched', 'İptal için doğrulanmış kayıt gerekli.');
  assert.ok(receipt.Rez_ID && receipt.environment, 'İptal devri için Rez_ID ve ortam gerekli.');
  return writePrivateJson(CI_CANCEL_RECEIPT, {
    Rez_ID: receipt.Rez_ID,
    environment: receipt.environment,
    state: receipt.state,
  });
}
