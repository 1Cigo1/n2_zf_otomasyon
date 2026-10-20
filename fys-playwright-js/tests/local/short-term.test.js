import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reservationDates, newTestCustomer } from '../../support/short-term-data.js';
import { exactText } from '../../components/form.controls.js';

test('Kısa dönem tarihleri ay/yıl geçişini ve İstanbul saatini korur', () => {
  assert.deepEqual(reservationDates({ startOffsetDays: 1 }, new Date('2026-12-30T22:30:00Z')), {
    start: '01.01.2027', end: '08.01.2027', time: '10:00',
  });
  assert.throws(() => reservationDates({ durationDays: 0 }));
  assert.throws(() => reservationDates({ startOffsetDays: NaN }));
});

test('Bugün teslim edilecek rezervasyon İstanbul tarihini ve çalıştırma dakikasını kullanır', () => {
  assert.deepEqual(reservationDates({}, new Date('2026-10-19T14:08:45Z')), {
    start: '19.10.2026', end: '26.10.2026', time: '17:08',
  });
  assert.deepEqual(reservationDates({}, new Date('2026-12-30T22:30:00Z')), {
    start: '31.12.2026', end: '07.01.2027', time: '01:30',
  });
  assert.throws(() => reservationDates({ startOffsetDays: -1 }));
});

test('Test kişisi ortak alanları ve ayrı kimliğiyle üretilir', () => {
  const a = newTestCustomer(), b = newTestCustomer();
  assert.match(a.identity, /^\d{11}$/);
  assert.notEqual(a.runId, b.runId);
  assert.match(a.email, /@example\.com$/);
});

test('Parantezli ofis adı regex olarak değil düz metin olarak eşleşir', () => {
  const pattern = exactText('Ankara Çankaya (Next Level AVM)');
  assert.equal(pattern.test('Ankara Çankaya (Next Level AVM)'), true);
  assert.equal(pattern.test('Ankara Çankaya Next Level AVM'), false);
});
