import { expect } from '@playwright/test';
import { ReservationClient } from './reservation.client.js';

const timestamp = (date, time) =>
  `${date.split('.').reverse().join('-')} ${time}:00`;

function clientForSavedReservation(request, saved) {
  return new ReservationClient(request).useRequestHeaders(saved.requestHeaders);
}

function assertCommon(body, { saved, customer }) {
  const data = body.reservationData;
  expect(data.id).toBe(saved.id);
  expect(data.customer.identity_no).toBe(customer.identity);
  expect(data.start_office.name).toBe('Ankara Çankaya (Next Level AVM)');
  expect(data.sipp_group.name).toBe('CDAD');
  expect(Boolean(data.driver)).toBe(true);
  expect(Boolean(data.reservation_code)).toBe(true);
  expect(Boolean(body.billingAddress?.id)).toBe(true);
  return data;
}

export async function assertStandardReservation(
  request,
  { saved, customer, dates },
) {
  const body = await clientForSavedReservation(request, saved)
    .getReservation(saved.id, saved.collectionPath);
  const data = assertCommon(body, { saved, customer });
  expect(data.skip_payment).toBe(true);
  expect(data.res_start_date).toBe(timestamp(dates.start, dates.time));
  expect(data.res_end_date).toBe(timestamp(dates.end, dates.time));
  expect(body.billingAddress.vkn).toBe(customer.identity);
  return data;
}

export function assertStandardReservationCreated(saved) {
  expect(saved.collectionPath).toBe('/api/short-term-rental/');
  expect(typeof saved.id).toBe('string');
  expect(Boolean(saved.code)).toBe(true);
}

export function assertCorporateReservationCreated(saved) {
  expect(saved.collectionPath).toBe('/api/corporate/short-term-rental/');
  expect(typeof saved.id).toBe('string');
  expect(Boolean(saved.code)).toBe(true);
}
