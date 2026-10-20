import { expect, visible } from '../support/fayt-common.js';
import { FaytModal, newWorkflowContext } from '../components/fayt-workflow.modal.js';

class FaytPage {
  constructor(page, env) { this.page = page; this.env = env; }

  async openWorkflow(key) {
    if (!key) throw new Error('Workflow adı boş bırakılamaz.');
    const base = this.env.baseURL;
    if (!base) throw new Error('Ortam URL bilgisi eksik.');
    const query = new URLSearchParams({ workflow_key: key, page: '1', rowsPerPage: '30' });
    await this.page.goto(`${base.replace(/\/$/, '')}/demand/list/${key}?${query}`, {
      waitUntil: 'domcontentloaded',
    });
    await this.page.getByRole('button', { name: 'Yeni' }).waitFor({ state: 'visible' });
  }

  async startRequest() {
    const modal = new FaytModal(this.page);
    for (let i = 0; i < 2; i++) {
      await this.page.getByRole('button', { name: 'Yeni' }).click();
      try {
        await modal.waitUntilOpen(15000);
        return modal;
      } catch (error) {
        if (error.name !== 'TimeoutError') throw error;
      }
    }
    throw new Error('Yeni talep modalı iki denemede de açılamadı.');
  }

  async searchPlate(plate) {
    const search = this.page.getByRole('textbox', { name: 'Herhangi bir şey arayın' }).first();
    await search.fill(plate);
    const area = search.locator("xpath=ancestor::div[.//button[.//*[contains(@class, 'ti-search')]]][1]");
    await area.locator('button:has(.ti-search)').first().click();
  }

  async requestRow(plate) {
    await this.searchPlate(plate);
    let row = this.page.locator('tbody tr').filter({ hasText: plate }).first();
    if (!await visible(row, 30000)) {
      await this.page.reload({ waitUntil: 'domcontentloaded' });
      await this.searchPlate(plate);
      row = this.page.locator('tbody tr').filter({ hasText: plate }).first();
      await row.waitFor({ state: 'visible', timeout: 30000 });
    }
    return row;
  }

  async advanceRequest(plate) {
    const row = await this.requestRow(plate);
    const action = row.locator('td').last()
      .locator('button:has(i.mdi-progress-check), button:has(i.mdi-check-all)').first();
    if (!await action.count() || !await action.isEnabled()) return false;
    await action.click();
    await new FaytModal(this.page).waitUntilOpen(30000);
    return true;
  }

  async processModal(modal, context) {
    const washing = ['standart_yikama', 'kiralama_donusu_yikama'].includes(context.workflowKey);
    const fuel = context.workflowKey === 'kiralama_donusu_yakit_alma';
    for (let i = 0; i < 40; i++) {
      if (!await modal.isOpen()) return context;
      let filled = false;
      if (await modal.hasField('Servis Noktası') && await modal.servicePoint(context)) filled = true;
      else if (await modal.hasField('Randevu Tarihi') && await modal.appointment(context)) filled = true;
      else if (await modal.hasField('Teslim Yapacak Kişi') && await modal.deliveryPerson(context)) filled = true;
      else if (await modal.hasField('Personel Ataması') && await modal.personnel(context)) filled = true;
      else if (await modal.hasField('Mono') && await modal.mono(context)) filled = true;
      else if (washing && await modal.isVehicleRequestCloseModal()
        && await modal.washingClose(context)) filled = true;
      else if (washing && await modal.hasField('Aracın KM') && await modal.hasButton('İlerlet')
        && await modal.washingAdvance(context)) filled = true;
      else if (fuel && !await modal.hasButton('Onayla')
        && (await modal.hasButton('İlerlet') || await modal.hasButton('Kapat'))
        && (await modal.hasField('Aracın KM') || await modal.hasFuelConditionField())
        && await modal.fuelCondition(context)) filled = true;
      else if (context.workflowKey === 'arac_bakim' && await modal.hasField('Aracın KM')
        && await modal.maintenanceKm(context)) filled = true;
      else if (await modal.hasField('Araç') && await modal.hasButton('Kaydet')) {
        if (context.workflowKey === 'arac_bakim') filled = await modal.maintenanceRequest(context);
        else if (washing) filled = await modal.washingRequest(context);
        else if (fuel) filled = await modal.fuelRequest(context);
      }
      if (filled) {
        await this.page.waitForTimeout(400);
        continue;
      }
      await modal.fillDescription();
      if (await modal.hasButton('Onayla')) {
        if (fuel && await modal.waitForDynamicFuelStep()) continue;
        if (!await modal.isOpen() || !await modal.hasButton('Onayla')) continue;
        await modal.clickAction('Onayla');
      } else if (await modal.hasButton('Kaydet')) {
        try { await modal.clickAction('Kaydet'); }
        catch (error) {
          if ((washing || fuel) && await modal.prepareAnotherVehicle(context, error)) continue;
          throw error;
        }
      } else if (await modal.hasButton('Kapat')) {
        await modal.clickAction('Kapat');
        context.requestClosed = true;
        return context;
      } else if (await modal.hasButton('İlerlet')) {
        await modal.clickAction('İlerlet');
      } else {
        throw new Error(`Tanınmayan modal: ${(await modal.dialog.innerText()).slice(0, 800)}`);
      }
    }
    throw new Error(`${context.workflowKey} modalı 40 adımda tamamlanamadı.`);
  }

  async run(workflowKey) {
    await this.openWorkflow(workflowKey);
    const context = newWorkflowContext(workflowKey);
    const modal = await this.startRequest();
    await this.processModal(modal, context);
    for (let i = 0; i < 10; i++) {
      if (context.requestClosed) return context;
      if (!context.selectedPlate) throw new Error('Araç seçilmeden talep ilerletilemez.');
      if (!await this.advanceRequest(context.selectedPlate)) return context;
      await this.processModal(modal, context);
    }
    throw new Error('Talep 10 ilerletme adımında tamamlanamadı.');
  }
}

export { FaytPage };
