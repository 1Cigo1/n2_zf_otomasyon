import { expect } from '@playwright/test';

export class FysClient {
  constructor(request) { this.request = request; this.headers = {}; }

  async login(credentials) {
    const response = await this.request.post('/api/auth/login', {
      data: { username: credentials.email, password: credentials.password, captcha_token: '' },
    });
    expect(response.status(), 'API login HTTP durumu').toBe(200);
    const body = await response.json();
    // Token değerlerini rapora basmadan varlık/tip kontrolü.
    expect(typeof body.access === 'string' && body.access.length > 0).toBe(true);
    expect(typeof body.refresh === 'string' && body.refresh.length > 0).toBe(true);
    expect(Boolean(body.session_key)).toBe(true);
    expect(Boolean(body.application_id)).toBe(true);
    this.headers = { 'application-id': String(body.application_id) };
    // APIRequestContext login yanıtındaki cookie'leri sonraki istekte taşır.
  }

  async me() {
    const response = await this.request.get('/api/auth/me', { headers: this.headers });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Boolean(body.data?.user)).toBe(true);
    expect(body.data).toHaveProperty('permissions');
    return body;
  }

  async washingList(key) {
    const response = await this.request.get('/api/demand/', {
      headers: this.headers, params: { workflow_key: key, page: 1, rowsPerPage: 5 },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    const body = await response.json();
    expect(Number.isInteger(body.total) && body.total >= 0).toBe(true);
    expect(Array.isArray(body.result)).toBe(true);
    expect(body.result.length).toBeLessThanOrEqual(5);
    for (const row of body.result) {
      for (const field of ['id', 'code', 'plate', 'status', 'workflow']) expect(row).toHaveProperty(field);
    }
    return body;
  }
}
