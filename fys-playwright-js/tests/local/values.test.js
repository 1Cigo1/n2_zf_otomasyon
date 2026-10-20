import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseKm, nextKm, plateOf, workflowURL } from '../../support/values.js';
import { environments } from '../../config/environments.js';

test('KM araç değerinden küçük olmaz ve önceki adım korunur', () => {
  assert.equal(nextKm(parseKm('21.400'), 21500), 21510);
  assert.equal(parseKm('21 400'), 21400);
  assert.throws(() => parseKm('--'));
});
test('Plaka sabit karakter sayısıyla kesilmez', () => {
  assert.equal(plateOf('06TST201 - HYUNDAI İ20'), '06TST201');
  assert.equal(plateOf('34 ABC 123 - FIAT'), '34 ABC 123');
});
test('Ortamlar ayrılır ve geçersiz ortam reddedilir', () => {
  assert.deepEqual(environments('all'), ['validation', 'dev']);
  assert.deepEqual(environments('dev'), ['dev']);
  assert.throws(() => environments('prod'));
});
test('Workflow query parametresi korunur', () => {
  const url = new URL(workflowURL('standart_yikama'), 'https://example.test');
  assert.equal(url.searchParams.get('workflow_key'), 'standart_yikama');
});
