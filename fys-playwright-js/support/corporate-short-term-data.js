function istanbulDateParts(now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const value = type => Number(parts.find(part => part.type === type).value);
  return { year: value('year'), month: value('month'), day: value('day') };
}

const format = date => [
  String(date.getUTCDate()).padStart(2, '0'),
  String(date.getUTCMonth() + 1).padStart(2, '0'),
  date.getUTCFullYear(),
].join('.');

export function corporateReservationPeriod(
  { durationDays = 7 } = {},
  now = new Date(),
) {
  if (!Number.isInteger(durationDays) || durationDays < 1) {
    throw new Error('Kurumsal rezervasyon süresi pozitif tam gün olmalı.');
  }
  const today = istanbulDateParts(now);
  const end = new Date(Date.UTC(today.year, today.month - 1, today.day));
  end.setUTCDate(end.getUTCDate() + durationDays);
  return { end: format(end) };
}

export function corporateCustomer(config) {
  return {
    identity: config.customerIdentity,
    firstName: config.customerFirstName,
    lastName: config.customerLastName,
    email: config.customerEmail,
    phone: config.customerPhone,
    country: config.customerCountry,
    province: config.customerProvince,
    district: config.customerDistrict,
    address: config.customerAddress,
    licenseNumber: config.customerLicenseNumber,
    licenseDate: config.customerLicenseDate,
  };
}

export function maskIdentifier(value = '') {
  return value ? `***${value.slice(-4)}` : 'tanımsız';
}
