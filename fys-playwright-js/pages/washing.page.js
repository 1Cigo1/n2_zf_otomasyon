import { expect } from '@playwright/test';
import { WashingModal } from '../components/washing.modal.js';
import { workflowURL } from '../support/values.js';

export class WashingPage {
  constructor(page, env) { this.page = page; this.env = env; this.modal = new WashingModal(page, env); }

  listResponse() {
    return this.page.waitForResponse(r => new URL(r.url()).pathname === '/api/demand/' && r.request().method() === 'GET');
  }

  async open() {
    const responsePromise = this.listResponse();
    await this.page.goto(workflowURL(this.env.workflowKey));
    const response = await responsePromise;
    expect(response.status(), 'Yıkama listesi API').toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.result)).toBe(true);
    this.maxExistingCode = Math.max(0, ...data.result.map(row => Number(row.code)));
    if (!Number.isFinite(this.maxExistingCode)) throw new Error('Talep kodları sayısal değil; satır eşleme güncellenmeli.');
    await expect(this.page.getByRole('button', { name: /^Yeni$/i })).toBeVisible();
  }

  async search(context) {
    const search = this.page.getByRole('textbox', { name: 'Herhangi bir şey arayın' });
    await search.fill(context.plate);
    const container = search.locator('xpath=ancestor::div[.//button[.//*[contains(@class,"ti-search")]]][1]');
    const responsePromise = this.listResponse();
    await container.locator('button:has(.ti-search)').click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const data = await response.json();
    if (!context.code) {
      const candidates = data.result.filter(row => row.plate === context.plate && Number(row.code) > this.maxExistingCode);
      expect(candidates.length, 'Yeni talep tekil bulunmalı; eski/aralarında belirsiz talep ilerletilmez').toBe(1);
      context.code = String(candidates[0].code);
    }
    const row = this.page.locator('tbody tr').filter({
      has: this.page.getByRole('cell', { name: context.code, exact: true }),
    }).filter({ has: this.page.getByRole('cell', { name: context.plate, exact: true }) });
    await expect(row).toHaveCount(1);
    await expect(row).toBeVisible();
    return row;
  }

  async complete(context) {
    await this.open();
    await this.page.getByRole('button', { name: /^Yeni$/i }).click();
    await this.modal.createRequest(context);
    for (let step = 0; step < 12; step++) {
      const row = await this.search(context);
      const action = row.locator('td').last().locator('button:has(.mdi-progress-check), button:has(.mdi-check-all)');
      await expect(action, `Talep ${context.code}: ilerlet aksiyonu yok`).toHaveCount(1);
      await action.click();
      await this.modal.fillCurrentStep(context);
      if (context.closed) return; // Kapat sonrası tekrar arama yapılmaz.
    }
    throw new Error('Yıkama talebi 12 modal adımında kapanmadı.');
  }
}
