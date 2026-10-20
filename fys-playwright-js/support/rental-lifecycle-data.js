const STAGES = [
  'reservation-saved',
  'agreement-uploaded',
  'sent-to-delivery',
  'vehicle-rented',
  'return-opened',
  'completed',
];

export const RENTAL_STAGES = Object.freeze([...STAGES]);

export function createRentalLifecycleContext({
  saved,
  customer,
  reservationType,
}) {
  if (!saved?.id || !saved?.code) {
    throw new Error('Yaşam döngüsü için rezervasyon id ve kodu gerekli.');
  }
  if (!customer?.identity) {
    throw new Error('İade kaydını doğrulamak için müşteri kimliği gerekli.');
  }
  if (!['standard', 'corporate'].includes(reservationType)) {
    throw new Error(`Desteklenmeyen rezervasyon tipi: ${reservationType}`);
  }

  return {
    reservationType,
    reservation: {
      id: saved.id,
      code: saved.code,
      collectionPath: saved.collectionPath,
    },
    customer: { identity: customer.identity },
    agreement: { uploaded: false },
    vehicle: {},
    stage: STAGES[0],
  };
}

export function advanceRentalStage(context, nextStage) {
  const current = STAGES.indexOf(context.stage);
  const next = STAGES.indexOf(nextStage);
  if (current < 0 || next !== current + 1) {
    throw new Error(`Geçersiz yaşam döngüsü geçişi: ${context.stage} → ${nextStage}`);
  }
  context.stage = nextStage;
  return context;
}

export function calculateReturnKm(deliveryKm, increment) {
  const digits = String(deliveryKm).replace(/[^\d]/g, '');
  const start = Number(digits);
  const delta = Number(increment);
  if (!digits || !Number.isSafeInteger(start) || start < 0) {
    throw new Error(`Geçersiz teslim KM değeri: ${deliveryKm}`);
  }
  if (!Number.isSafeInteger(delta) || delta < 0) {
    throw new Error(`Geçersiz iade KM artışı: ${increment}`);
  }
  return start + delta;
}

export function lifecycleArtifact(context) {
  const identity = context.customer?.identity || '';
  return {
    reservationType: context.reservationType,
    reservation: {
      id: context.reservation?.id,
      code: context.reservation?.code,
    },
    customer: { identity: identity ? `***${identity.slice(-4)}` : undefined },
    agreement: { uploaded: Boolean(context.agreement?.uploaded) },
    vehicle: {
      plate: context.vehicle?.plate,
      deliveryKm: context.vehicle?.deliveryKm,
      returnKm: context.vehicle?.returnKm,
    },
    stage: context.stage,
  };
}
