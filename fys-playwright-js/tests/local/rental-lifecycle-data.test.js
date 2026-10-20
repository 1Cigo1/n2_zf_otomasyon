import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceRentalStage,
  calculateReturnKm,
  createRentalLifecycleContext,
  lifecycleArtifact,
} from '../../support/rental-lifecycle-data.js';

test('Yaşam döngüsü yalnız sıralı aşamalarla ilerler', () => {
  const context = createRentalLifecycleContext({
    saved: {
      id: 'reservation-id',
      code: 'ZF123',
      collectionPath: '/api/short-term-rental/',
    },
    customer: { identity: '12345678901' },
    reservationType: 'standard',
  });

  assert.equal(context.stage, 'reservation-saved');
  advanceRentalStage(context, 'agreement-uploaded');
  advanceRentalStage(context, 'sent-to-delivery');
  assert.equal(context.stage, 'sent-to-delivery');
  assert.throws(
    () => advanceRentalStage(context, 'completed'),
    /Geçersiz yaşam döngüsü geçişi/,
  );
});

test('İade KM teslim KM değerinden yapılandırılmış miktar kadar büyüktür', () => {
  assert.equal(calculateReturnKm('33.600 km', 30), 33630);
  assert.throws(() => calculateReturnKm('', 30), /Geçersiz teslim KM/);
  assert.throws(() => calculateReturnKm(100, -1), /Geçersiz iade KM artışı/);
});

test('CI eki kimliği maskeler ve istek headerlarını taşımaz', () => {
  const context = createRentalLifecycleContext({
    saved: { id: 'id-1', code: 'ZF1', collectionPath: '/api/example/' },
    customer: { identity: '12345678901' },
    reservationType: 'corporate',
  });
  context.vehicle = { plate: '06TST001', deliveryKm: 100, returnKm: 130 };

  const artifact = lifecycleArtifact(context);
  assert.equal(artifact.customer.identity, '***8901');
  assert.equal(artifact.vehicle.returnKm, 130);
  assert.equal('requestHeaders' in artifact.reservation, false);
});
