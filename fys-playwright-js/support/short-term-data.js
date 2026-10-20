import { randomInt, randomUUID } from 'node:crypto';

export function reservationDates({ startOffsetDays = 0, durationDays = 7 } = {}, now = new Date()) {
  if (!Number.isInteger(startOffsetDays) || startOffsetDays < 0 ||
      !Number.isInteger(durationDays) || durationDays < 1) {
    throw new Error('Başlangıç uzaklığı sıfır veya pozitif, kiralama süresi pozitif tam gün olmalı.');
  }
  // CI sunucusunun saat diliminden bağımsız İstanbul takvim tarihi.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const value = type => Number(parts.find(part => part.type === type).value);
  const start = new Date(Date.UTC(value('year'), value('month') - 1, value('day') + startOffsetDays));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + durationDays);
  const format = date => `${String(date.getUTCDate()).padStart(2, '0')}.${String(date.getUTCMonth() + 1).padStart(2, '0')}.${date.getUTCFullYear()}`;
  // Bugün teslim edilen yaşam döngüsünde başlangıç saati de şu anı izlemeli.
  const time = startOffsetDays === 0
    ? `${String(value('hour')).padStart(2, '0')}:${String(value('minute')).padStart(2, '0')}`
    : '10:00';
  return { start: format(start), end: format(end), time };
}

export function newTestCustomer() {
  const runId = randomUUID().slice(0, 8);
  return {
    runId,
    // Python testindeki gibi sentetik 11 haneli veri; gerçek kimlik verisi değildir.
    identity: String(randomInt(10000000000, 99999999999)),
    firstName: 'Otomasyon', lastName: `Kisa${runId.replace(/[0-9]/g, 'a')}`,
    email: `short-term-${runId}@example.com`, phone: '5467890123',
    birthDate: '01.01.2000', licenseNumber: String(randomInt(100000000, 999999999)),
    licenseDate: '01.01.2020', province: 'Ankara', district: 'Yenimahalle',
    address: 'Otomasyon test adresi, Next Level AVM, Çankaya, Ankara',
  };
}
