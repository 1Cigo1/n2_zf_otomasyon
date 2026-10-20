import { expect } from '@playwright/test';

const MONTH_NAME = /^(Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)(\s+\d{4})?$/i;
const EXCLUDED_SERVICES = new Set(['ek sürücü']);
const normalize = value => value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr-TR');

export class AdditionalServicesSection {
  constructor(page) {
    this.page = page;
    this.heading = page.getByText('Ek Hizmet ve Teklifler', { exact: true }).first();
    this.monthlyTab = page.getByRole('tab', { name: 'Aylık Özelleştir', exact: true });
    this.bulkTab = page.getByRole('tab', { name: 'Toplu İşlem', exact: true });
  }

  get section() {
    return this.heading.locator(
      'xpath=ancestor::*[.//*[@role="checkbox"] or .//input[@type="checkbox"]][1]',
    );
  }

  async selectForPeriods({ preferredService = '' } = {}) {
    await expect(this.heading).toBeVisible();
    const monthlyAvailable = await this.monthlyTab.count() > 0 &&
      await this.monthlyTab.isVisible() && await this.monthlyTab.isEnabled();

    if (monthlyAvailable) {
      await this.monthlyTab.click();
      await expect(this.monthlyTab).toHaveAttribute('aria-selected', 'true');
      await expect(
        this.section.getByRole('tab', { name: MONTH_NAME }).first(),
      ).toBeVisible({ timeout: 15000 });
      const periods = await this.visibleMonthNames();
      if (periods.length > 1) {
        const selections = [];
        for (const period of periods) {
          const tab = this.section.getByRole('tab', { name: period, exact: true });
          await tab.click();
          await expect(tab).toHaveAttribute('aria-selected', 'true');
          await expect(this.section.getByRole('checkbox').first()).toBeVisible();
          await this.waitForSelectableService();
          selections.push({
            period,
            service: await this.selectOne(preferredService),
          });
        }
        return selections;
      }
    }

    if (await this.bulkTab.count() > 0 && await this.bulkTab.isVisible()) {
      await this.bulkTab.click();
    }
    await this.waitForSelectableService();
    return [{
      period: 'Tüm dönem',
      service: await this.selectOne(preferredService),
    }];
  }

  async visibleMonthNames() {
    const tabs = this.section.getByRole('tab');
    const names = [];
    for (let index = 0; index < await tabs.count(); index += 1) {
      const tab = tabs.nth(index);
      if (!await tab.isVisible()) continue;
      const name = (await tab.innerText()).replace(/\s+/g, ' ').trim();
      if (MONTH_NAME.test(name)) names.push(name);
    }
    return names;
  }

  async selectableServices() {
    const checkboxes = this.section.getByRole('checkbox');
    const candidates = [];
    for (let index = 0; index < await checkboxes.count(); index += 1) {
      const checkbox = checkboxes.nth(index);
      if (!await checkbox.isVisible() || !await checkbox.isEnabled() || await checkbox.isChecked()) continue;
      const name = await this.serviceName(checkbox) || `Ek hizmet #${index + 1}`;
      if (EXCLUDED_SERVICES.has(normalize(name))) continue;
      candidates.push({ checkbox, name });
    }
    return candidates;
  }

  async waitForSelectableService() {
    await expect.poll(
      async () => (await this.selectableServices()).length,
      {
        message: 'Ek Sürücü dışındaki ek hizmet seçenekleri bekleniyor',
        timeout: 15000,
      },
    ).toBeGreaterThan(0);
  }

  async selectOne(preferredService) {
    const candidates = await this.selectableServices();
    if (!candidates.length) {
      throw new Error('Ek Sürücü haricinde seçilebilir ek hizmet bulunamadı.');
    }

    const selected = preferredService
      ? candidates.find(candidate => normalize(candidate.name) === normalize(preferredService))
      : candidates[0];
    if (!selected) {
      throw new Error(
        `"${preferredService}" bulunamadı. Seçilebilir hizmetler: ${candidates.map(item => item.name).join(', ')}`,
      );
    }

    await selected.checkbox.scrollIntoViewIfNeeded();
    await selected.checkbox.check();
    await expect(selected.checkbox).toBeChecked();
    return selected.name;
  }

  serviceName(checkbox) {
    return checkbox.evaluate(element => {
      const label = element.labels?.[0];
      if (label?.innerText?.trim()) return label.innerText.trim();
      const ariaLabel = element.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel.trim();
      const labelledBy = element.getAttribute('aria-labelledby');
      if (labelledBy) {
        const text = labelledBy.split(/\s+/)
          .map(id => document.getElementById(id)?.innerText || '')
          .join(' ').trim();
        if (text) return text;
      }
      const card = element.closest('label, li, [class*="card"], .v-col');
      return (card?.innerText || '').split('\n')[0].trim();
    });
  }
}
