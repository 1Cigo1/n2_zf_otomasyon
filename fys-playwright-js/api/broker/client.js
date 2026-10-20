import assert from 'node:assert/strict';

export function missingBrokerSettings() {
  return ['BROKER_TOKEN', 'BROKER_COMPANY_ID', 'BROKER_APPLICATION_ID']
    .filter((name) => !String(process.env[name] || '').trim());
}

function connectionReason(error) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('timeout') || message.includes('timed out')) return 'süre aşıldı';
  if (message.includes('econnreset') || message.includes('socket hang up')) return 'bağlantı kapatıldı';
  if (message.includes('enotfound') || message.includes('eai_again')) return 'DNS çözümlenemedi';
  if (message.includes('econnrefused')) return 'bağlantı reddedildi';
  if (message.includes('certificate') || message.includes('ssl') || message.includes('tls')) {
    return 'TLS hatası';
  }
  return 'bağlantı hatası';
}

export async function createBrokerRequest(playwright, env) {
  const missing = missingBrokerSettings();
  assert.deepEqual(missing, [], `Broker ayarı eksik: ${missing.join(', ')}`);
  assert.ok(env.baseURL, 'Broker için ortam URL adresi eksik.');

  const token = process.env.BROKER_TOKEN.trim();
  const scheme = process.env.BROKER_AUTH_SCHEME?.trim() || 'Token';
  assert.ok(!token.toLowerCase().startsWith(`${scheme.toLowerCase()} `),
    'BROKER_TOKEN içine yalnız token değerini yazın.');

  // FYS login cookie'sinden ayrı bağlam: Broker kendi token başlığını kullanır.
  const context = await playwright.request.newContext({
    baseURL: env.baseURL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      Authorization: `${scheme} ${token}`,
      'company-id': process.env.BROKER_COMPANY_ID.trim(),
      'application-id': process.env.BROKER_APPLICATION_ID.trim(),
    },
  });

  async function send(method, url, options = {}) {
    const { retryOnce = false, ...requestOptions } = options;
    const maxAttempts = method === 'GET' && retryOnce ? 2 : 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        if (method === 'GET') return await context.get(url, requestOptions);
        return await context.post(url, requestOptions);
      } catch (error) {
        if (attempt === maxAttempts) {
          // Ham Playwright hatası gizli başlıklar içerebilir.
          throw new Error(`Broker ${method} isteği tamamlanamadı: ${connectionReason(error)}.`);
        }
        console.log('GET yanıt almadan hata verdi; bir kez daha deneniyor.');
      }
    }
  }

  return {
    get: (url, options) => send('GET', url, options),
    post: (url, options) => send('POST', url, options),
    dispose: () => context.dispose(),
  };
}
