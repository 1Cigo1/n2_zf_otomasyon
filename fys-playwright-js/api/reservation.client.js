import { expect } from '@playwright/test';
import { FysClient } from './fys.client.js';

export class ReservationClient extends FysClient {
  async login(credentials) {
    await super.login(credentials);
    const profile = await this.me();
    const companyId = profile.data.user.selected_company?.id;
    expect(Boolean(companyId), 'Mono/rezervasyon API için seçili şirket gerekli').toBe(true);
    this.headers['company-id'] = String(companyId);
  }

  async list(path, fields, params = {}) {
    const response = await this.request.get(path, {
      headers: this.headers, params: { page: 1, rowsPerPage: 5, ...params },
    });
    const errorDetail = response.ok() ? '' : (await response.json().catch(() => ({}))).detail || '';
    expect(response.status(), `${path} HTTP durumu. ${errorDetail}`).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    const body = await response.json();
    expect(Number.isInteger(body.total) && body.total >= 0).toBe(true);
    expect(Array.isArray(body.result)).toBe(true);
    expect(body.result.length).toBeLessThanOrEqual(5);
    for (const row of body.result) {
      for (const field of fields) expect(row).toHaveProperty(field);
    }
    return body;
  }

  customers(search = '') {
    return this.list('/api/customer/', ['id', 'identity_no', 'name'], {
      only_autocomplete: true, ...(search ? { search } : {}),
    });
  }
  specialCustomers() {
    return this.list('/api/customer-partner/extra/', ['customer_id', 'identity_no', 'is_vip']);
  }
  reservations() {
    return this.list('/api/short-term-rental/', ['id', 'customer_id', 'reservation_code', 'res_start_date', 'res_end_date']);
  }

  useRequestHeaders(headers) {
    this.headers = {
      'application-id': headers['application-id'],
      'company-id': headers['company-id'],
    };
    return this;
  }

  async getReservation(id, collectionPath = '/api/short-term-rental/') {
    const response = await this.request.get(
      `${collectionPath}${encodeURIComponent(id)}/`,
      { headers: this.headers },
    );
    expect(response.status(), 'Kaydedilen rezervasyon API yanıtı').toBe(200);
    return response.json();
  }

}
