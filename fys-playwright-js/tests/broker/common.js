import { missingBrokerSettings } from '../../api/broker/client.js';

export function requireBrokerOrSkip(test) {
  const missing = missingBrokerSettings();
  if (missing.length === 0) return;
  const message = `Broker ayarı eksik: ${missing.join(', ')}`;
  if (process.env.CI?.toLowerCase() === 'true'
    || process.env.BROKER_REQUIRE_CONFIG?.toLowerCase() === 'true') {
    throw new Error(message);
  }
  test.skip(true, message);
}
