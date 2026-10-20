import { expect, visible, fileUpload, uploadSeparate, uploadMultiple } from '../support/fayt-common.js';

const photos = ['egea_ön.jpg', 'egea_ön1.jpeg', 'egea_sağ.jpg', 'egea_sol.jpg', 'egea_arka.jpeg', 'egea_iç.jpg'];
const vehiclePattern = /^\d{2}[A-ZÇĞİÖŞÜ]{1,3}\d{2,4}\s+-/;
const fuelVehiclePattern = /^\d{2}[A-ZÇĞİÖŞÜ]{1,3}\d{2,4}\s+-.*\(\d+\s*\//;
const activeRequestText = 'Bu araç için aynı iş akışında aktif bir talep bulunmaktadır';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function newWorkflowContext(workflowKey) {
  return {
    workflowKey, selectedVehicle: null, selectedPlate: null, initialKm: null,
    currentVehicleKm: null, finalKm: null, values: {},
    attemptedVehicles: new Set(), requestClosed: false,
  };
}

class FaytModal {
  constructor(page) {
    this.page = page;
    this.reportedMessages = new Set();
  }

  get dialog() { return this.page.locator(".v-dialog[role='dialog']:visible").last(); }
  async waitUntilOpen(timeout = 10000) { await this.dialog.waitFor({ state: 'visible', timeout }); }
  async isOpen() { return await this.dialog.count() > 0; }

  async field(label) {
    const byLabel = this.dialog.getByLabel(label, { exact: true });
    if (await byLabel.count()) return byLabel;
    const byPlaceholder = this.dialog.getByPlaceholder(label, { exact: true });
    if (await byPlaceholder.count()) return byPlaceholder;
    return this.dialog.locator('.v-input').filter({ hasText: label }).locator('input').first();
  }

  async hasField(label) {
    const field = await this.field(label);
    return await field.count() > 0 && await field.isVisible();
  }

  async button(name) {
    const safeName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const buttons = this.dialog.getByRole('button', { name: new RegExp(`^${safeName}$`, 'i') });
    if (name.toLocaleLowerCase('tr') !== 'kapat') return buttons;
    for (let i = 0; i < await buttons.count(); i++) {
      const button = buttons.nth(i);
      const aria = (await button.getAttribute('aria-label') || '').toLocaleLowerCase('tr');
      if (aria !== 'kapat') return button;
    }
    return this.dialog.locator('button[data-fys-action-not-found]');
  }

  async hasButton(name) {
    const button = await this.button(name);
    return await button.count() > 0 && await button.isVisible();
  }

  async isVehicleRequestCloseModal() {
    return await this.hasButton('Kapat')
      && await visible(this.dialog.getByText('Araç Talebini Kapat', { exact: true }), 200);
  }

  async chooseOption(field, name, { excluded = new Set(), required = null, preferred = null } = {}) {
    await field.locator('xpath=..').click();
    await field.press('ArrowDown');
    const options = this.page.locator(".v-overlay--active [role='listbox'] [role='option']:visible");
    await options.first().waitFor({ state: 'visible', timeout: 5000 });
    const candidates = [];
    for (let i = 0; i < await options.count(); i++) {
      const text = (await options.nth(i).innerText()).trim();
      if (!excluded.has(text) && (!required || required.test(text))) candidates.push({ i, text });
    }
    const preferredOptions = preferred ? candidates.filter(item => preferred.test(item.text)) : [];
    const pool = preferredOptions.length ? preferredOptions : candidates;
    if (!pool.length) throw new Error(`${name} için daha önce denenmemiş seçenek kalmadı.`);
    const choice = pool[Math.floor(Math.random() * pool.length)];
    await options.nth(choice.i).click();
    return choice.text;
  }

  async fillDescription() {
    const editor = this.dialog.locator('.ql-editor');
    if (await visible(editor, 100)) await editor.fill('Otomasyon testi');
  }

  async displayedVehicleKm() {
    const heading = this.dialog.getByRole('heading', { name: 'Kilometre', exact: true });
    if (!await visible(heading, 100)) throw new Error('Modalda aracın mevcut kilometresi bulunamadı.');
    const value = await heading.locator('xpath=following-sibling::*[1]').innerText();
    const digits = value.replace(/\D/g, '');
    if (!digits) throw new Error(`Araç kilometresi sayısal değil: ${value}`);
    return Number(digits);
  }

  async maintenanceRequest(context) {
    if (!await this.hasField('Araç')) return false;
    if (!context.selectedVehicle) {
      context.selectedVehicle = await this.chooseOption(await this.field('Araç'), 'Araç');
      context.selectedPlate = context.selectedVehicle.split(' - ')[0];
      return true;
    }
    if (await this.hasField('Araç KM') && context.initialKm === null) {
      context.initialKm = 1000000;
      await (await this.field('Araç KM')).fill(String(context.initialKm));
      return true;
    }
    for (const [label, key] of [['Bakım Periyodu', 'maintenance_period'], ['Bakım Türü', 'maintenance_type']]) {
      if (await this.hasField(label) && !(key in context.values)) {
        context.values[key] = await this.chooseOption(await this.field(label), label);
        return true;
      }
    }
    if (!('maintenance_photos' in context.values)) {
      await fileUpload(this.page, ['egea_arka.jpeg', 'egea_iç.jpg', 'egea_ön.jpg', 'egea_ön1.jpeg', 'egea_sağ.jpg', 'egea_sol.jpg']);
      context.values.maintenance_photos = 'true';
      return true;
    }
    await this.fillDescription();
    return false;
  }

  async washingRequest(context) {
    return this.photoRequest(context, 'washing_request_photos', 'Standart Yıkama');
  }

  async fuelRequest(context) {
    if (context.selectedVehicle && 'fuel_request_photos' in context.values && await this.hasField('Yakıt Seviyesi (1-8)')) {
      const fuel = await this.field('Yakıt Seviyesi (1-8)');
      if ((await fuel.inputValue()).trim() === '4') {
        context.values.fuel_level = '4';
        return false;
      }
      await fuel.fill('4');
      await fuel.press('Tab');
      await expect(fuel).toHaveValue('4', { timeout: 5000 });
      context.values.fuel_level = '4';
      return true;
    }
    return this.photoRequest(context, 'fuel_request_photos', 'Kiralama Dönüşü Yakıt Alma', {
      multipleName: 'Araç Fotoğrafları', requiredPattern: fuelVehiclePattern,
    });
  }

  async photoRequest(context, completedKey, workflowName, { multipleName = null, requiredPattern = vehiclePattern } = {}) {
    if (!await this.hasField('Araç')) return false;
    const fileInputs = this.dialog.locator("input[type='file']");
    if (!context.selectedVehicle) {
      for (let attempt = context.attemptedVehicles.size; attempt < 15; attempt++) {
        const selected = await this.chooseOption(await this.field('Araç'), 'Araç', {
          excluded: context.attemptedVehicles, required: requiredPattern,
        });
        context.attemptedVehicles.add(selected);
        const needed = multipleName ? fileInputs.first() : fileInputs.nth(photos.length - 1);
        if (!await visible(needed, multipleName ? 3000 : 5000)) {
          // The file input can be hidden. Wait for DOM attachment below instead.
          try { await needed.waitFor({ state: 'attached', timeout: multipleName ? 3000 : 5000 }); }
          catch (error) { if (error.name === 'TimeoutError') continue; throw error; }
        }
        context.selectedVehicle = selected;
        context.selectedPlate = selected.split(' - ')[0];
        return true;
      }
      throw new Error(`15 araç için de ${workflowName} fotoğraf alanları açılmadı.`);
    }
    if (!(completedKey in context.values)) {
      if (multipleName) await uploadMultiple(this.dialog, multipleName, photos);
      else await uploadSeparate(this.dialog, photos);
      context.values[completedKey] = 'true';
      return true;
    }
    await this.fillDescription();
    return false;
  }

  static activeRequestMessage(message) {
    return message.toLocaleLowerCase('tr').includes(activeRequestText.toLocaleLowerCase('tr'));
  }

  async prepareAnotherVehicle(context, failure) {
    if (!await this.hasField('Araç') || !await this.hasButton('Kaydet')) return false;
    const message = await this.validationMessages();
    const hasActive = FaytModal.activeRequestMessage(`${failure.message} | ${message}`);
    const unexplainedFuel = context.workflowKey === 'kiralama_donusu_yakit_alma'
      && failure.message.includes('Kaydet tıklandı fakat modal') && !message;
    if (!hasActive && !unexplainedFuel) return false;
    const inputs = this.dialog.locator("input[type='file']");
    for (let i = 0; i < await inputs.count(); i++) await inputs.nth(i).setInputFiles([]);
    context.selectedVehicle = null;
    context.selectedPlate = null;
    delete context.values.fuel_level;
    delete context.values.fuel_request_photos;
    delete context.values.washing_request_photos;
    return true;
  }

  async chooseIfEmpty(label, key, context) {
    if (!await this.hasField(label)) return false;
    const field = await this.field(label);
    const value = (await field.inputValue()).trim();
    if (value) { context.values[key] = value; return false; }
    context.values[key] = await this.chooseOption(field, label);
    return true;
  }

  async servicePoint(context) { return this.chooseIfEmpty('Servis Noktası', 'service', context); }
  async personnel(context) { return this.chooseIfEmpty('Personel Ataması', 'personnel', context); }
  async deliveryPerson(context) { return this.chooseIfEmpty('Teslim Yapacak Kişi', 'delivery_person', context); }
  async mono(context) { return this.chooseIfEmpty('Mono', 'mono', context); }

  async appointment(context) {
    if (!await this.hasField('Randevu Tarihi')) return false;
    const field = await this.field('Randevu Tarihi');
    const value = (await field.inputValue()).trim();
    if (value) { context.values.appointment = value; return false; }
    await field.locator('xpath=..').click();
    await field.press('ArrowDown');
    const days = this.page.locator(".p-datepicker-day[aria-disabled='false']:visible");
    await days.first().waitFor({ state: 'visible', timeout: 5000 });
    const choice = days.nth(Math.floor(Math.random() * await days.count()));
    context.values.appointment = (await choice.innerText()).trim();
    await choice.click();
    return true;
  }

  async maintenanceKm(context) {
    if (!await this.hasField('Aracın KM') || !await this.hasField('Yakıt Miktarı Yakıt Miktarı ')
      || await this.hasButton('Kapat') || 'maintenance_final_km' in context.values) return false;
    const current = await this.displayedVehicleKm();
    context.currentVehicleKm = current;
    context.finalKm = Math.max(current, context.initialKm || 0) + 10 + Math.floor(Math.random() * 91);
    await (await this.field('Aracın KM')).fill(String(context.finalKm));
    await (await this.field('Yakıt Miktarı Yakıt Miktarı ')).fill('4');
    context.values.maintenance_final_km = 'true';
    return true;
  }

  static async numericValue(locator) {
    const digits = (await locator.inputValue()).replace(/\D/g, '');
    return digits ? Number(digits) : null;
  }

  static async filesFilled(inputs, count) {
    if (await inputs.count() < count) return false;
    for (let i = 0; i < count; i++) {
      if (!await inputs.nth(i).evaluate(input => Boolean(input.files?.length))) return false;
    }
    return true;
  }

  static async multipleFilled(input, count) {
    return await input.count() > 0
      && await input.evaluate((element, required) => Boolean(element.files?.length >= required), count);
  }

  async resolveConditionFields() {
    if (await this.hasField('Aracın KM')) {
      const km = await this.field('Aracın KM');
      for (const name of ['Yakıt Miktarı', 'Yakıt Miktarı Yakıt Miktarı ']) {
        if (await this.hasField(name)) return [km, await this.field(name)];
      }
    }
    const selector = "input.v-field__input:visible:not([disabled]):not([readonly]):not([type='file']):not([type='hidden'])";
    const numbers = this.dialog.locator(`${selector}[type='number']`);
    if (await numbers.count() === 2) return [numbers.nth(0), numbers.nth(1)];
    const editable = this.dialog.locator(selector);
    if (await editable.count() === 2) return [editable.nth(0), editable.nth(1)];
    return null;
  }

  async waitForConditionFields(timeout = 10000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await this.hasButton('Onayla')) return null;
      const fields = await this.resolveConditionFields();
      if (fields) return fields;
      await sleep(100);
    }
    const content = (await this.dialog.innerText()).replace(/\s+/g, ' ');
    throw new Error(`KM ve yakıt alanları ${timeout / 1000} saniyede açılmadı. Modal: ${content.slice(0, 500)}`);
  }

  async hasFuelConditionField() {
    const action = await this.hasButton('İlerlet') || await this.hasButton('Kapat');
    const heading = this.dialog.getByRole('heading', { name: 'Kilometre', exact: true });
    return action && (await this.resolveConditionFields() !== null || await visible(heading, 100));
  }

  async washingCondition(context, action, key) {
    if (!await this.hasButton(action)) return false;
    let fields = await this.waitForConditionFields();
    if (!fields) return false;
    const current = await this.displayedVehicleKm();
    context.currentVehicleKm = current;
    const separateSelector = "input[type='file'][required]:not([multiple])";
    const multipleSelector = "input[type='file'][multiple]";
    const separate = this.dialog.locator(separateSelector);
    const multiple = this.dialog.locator(multipleSelector).first();
    const hasMultiple = await multiple.count() > 0;
    const requiresPhotos = hasMultiple || await separate.count() > 0;
    if (requiresPhotos) {
      if (hasMultiple && !await FaytModal.multipleFilled(multiple, photos.length)) {
        await uploadMultiple(this.dialog, 'Araç Fotoğrafları', photos, multipleSelector);
      } else if (!hasMultiple && !await FaytModal.filesFilled(separate, photos.length)) {
        await separate.nth(photos.length - 1).waitFor({ state: 'attached', timeout: 10000 });
        await uploadSeparate(this.dialog, photos, separateSelector);
      }
    }
    fields = await this.waitForConditionFields();
    if (!fields) return false;
    let [km, fuel] = fields;
    const entered = await FaytModal.numericValue(km);
    if (entered !== null && entered >= current && (await fuel.inputValue()).trim() === '4') {
      context.finalKm = entered;
      context.values[key] = 'true';
      return false;
    }
    if (entered !== null && entered >= current) context.finalKm = entered;
    else {
      context.finalKm = Math.max(current, context.finalKm || 0) + 10 + Math.floor(Math.random() * 91);
      await km.fill(String(context.finalKm));
      await km.press('Tab');
    }
    fields = await this.waitForConditionFields(5000);
    if (!fields) return false;
    fuel = fields[1];
    await fuel.click();
    await fuel.fill('');
    await fuel.pressSequentially('4', { delay: 100 });
    await fuel.press('Tab');
    fields = await this.waitForConditionFields(5000);
    if (!fields) return false;
    [km, fuel] = fields;
    const finalKm = await FaytModal.numericValue(km);
    if (finalKm === null || finalKm < current) throw new Error('Yıkama KM değeri mevcut KM’den düşük.');
    context.finalKm = finalKm;
    await expect(fuel).toHaveValue('4', { timeout: 5000 });
    if (requiresPhotos) {
      const ready = hasMultiple
        ? await FaytModal.multipleFilled(this.dialog.locator(multipleSelector).first(), photos.length)
        : await FaytModal.filesFilled(this.dialog.locator(separateSelector), photos.length);
      if (!ready) throw new Error('Yıkama fotoğrafları doldurma sırasında kayboldu.');
    }
    await this.fillDescription();
    context.values[key] = 'true';
    return true;
  }

  async washingClose(context) { return this.washingCondition(context, 'Kapat', 'washing_close_filled'); }
  async washingAdvance(context) { return this.washingCondition(context, 'İlerlet', 'washing_advance_filled'); }

  async fuelCondition(context) {
    const advance = await this.hasButton('İlerlet');
    const key = await this.hasButton('Kapat') ? 'fuel_close_filled'
      : advance ? 'fuel_advance_filled' : null;
    if (!key) return false;
    let fields = await this.waitForConditionFields();
    if (!fields) return false;
    const current = await this.displayedVehicleKm();
    context.currentVehicleKm = current;
    const fileInputs = this.dialog.locator("input[type='file']");
    if (advance) {
      await fileInputs.nth(photos.length - 1).waitFor({ state: 'attached', timeout: 10000 });
      if (!await FaytModal.filesFilled(fileInputs, photos.length)) await uploadSeparate(this.dialog, photos);
    }
    fields = await this.waitForConditionFields();
    if (!fields) return false;
    let [km, fuel] = fields;
    let entered = await FaytModal.numericValue(km);
    if (entered !== null && entered > current && (await fuel.inputValue()).trim() === '4') {
      context.values[key] = 'true';
      return false;
    }
    context.finalKm = Math.max(current, context.finalKm || 0) + 10 + Math.floor(Math.random() * 91);
    await km.fill(String(context.finalKm));
    await km.press('Tab');
    fields = await this.waitForConditionFields(5000);
    if (!fields) return false;
    fuel = fields[1];
    await fuel.fill('4');
    await fuel.press('Tab');
    fields = await this.waitForConditionFields(5000);
    if (!fields) return false;
    [km, fuel] = fields;
    await expect(km).toHaveValue(String(context.finalKm), { timeout: 5000 });
    await expect(fuel).toHaveValue('4', { timeout: 5000 });
    if (advance && !await FaytModal.filesFilled(this.dialog.locator("input[type='file']"), photos.length)) {
      throw new Error('Yakıt fotoğrafları doldurma sırasında kayboldu.');
    }
    await this.fillDescription();
    context.values[key] = 'true';
    return true;
  }

  async waitForDynamicFuelStep(timeout = 10000) {
    try {
      await this.page.waitForFunction(() => {
        const dialogs = Array.from(document.querySelectorAll(".v-dialog[role='dialog'].v-overlay--active"))
          .filter(element => element.isConnected && element.getClientRects().length > 0);
        const dialog = dialogs.at(-1);
        if (!dialog) return true;
        const actions = Array.from(dialog.querySelectorAll('button'))
          .map(button => button.textContent.trim().toLocaleUpperCase('tr-TR'));
        return dialog.querySelectorAll("input[type='file']").length >= 6
          || actions.includes('İLERLET') || actions.includes('KAPAT');
      }, undefined, { timeout });
      return true;
    } catch (error) {
      if (error.name === 'TimeoutError') return false;
      throw error;
    }
  }

  async validationMessages() {
    const elements = this.page.locator(
      ".v-messages__message:visible, .p-toast-message-text:visible, .v-snackbar__content:visible, "
      + "[role='alert']:not(.v-alert):visible, .v-alert.text-error:visible, .v-alert.bg-error:visible",
    );
    const messages = (await elements.allInnerTexts()).map(text => text.trim()).filter(Boolean);
    for (const message of messages) {
      if (!this.reportedMessages.has(message)) {
        console.log(`[SİSTEM MESAJI] ${message}`);
        this.reportedMessages.add(message);
      }
    }
    return messages.join(' | ');
  }

  async waitUntilSaved(originalDialog, timeout = 30000, actionName = 'Kaydet') {
    const deadline = Date.now() + timeout;
    const observed = [];
    while (Date.now() < deadline) {
      const messages = await this.validationMessages();
      if (!await originalDialog.isVisible().catch(() => false)) {
        await sleep(300);
        await this.validationMessages();
        return;
      }
      if (messages && !observed.includes(messages)) observed.push(messages);
      if (FaytModal.activeRequestMessage(messages)) {
        throw new Error(`${actionName} sırasında seçilen araç için aktif talep bulundu. Mesaj: ${messages}`);
      }
      await sleep(100);
    }
    if (!await originalDialog.isVisible().catch(() => false)) return;
    throw new Error(`${actionName} tıklandı fakat modal ${timeout / 1000} saniyede kapanmadı. Plaka aramasına geçilmedi; seçilen araç korundu. Beklerken görülen mesajlar: ${observed.join(' | ') || 'mesaj bulunamadı'}`);
  }

  async clickAction(name) {
    if (!await this.isOpen()) return;
    const original = await this.dialog.elementHandle();
    const oldText = await original.innerText();
    const longAction = ['İlerlet', 'Onayla'].includes(name);
    const readyDeadline = Date.now() + (longAction ? 60000 : 15000);
    let action;
    while (Date.now() < readyDeadline) {
      if (!await original.isVisible().catch(() => false)) return;
      action = (await this.button(name)).locator(
        "xpath=self::*[not(@aria-busy='true') and not(contains(@class, 'v-btn--loading')) and not(@disabled) and not(@aria-disabled='true')]",
      );
      if (await action.count() > 0 && await action.isVisible()) break;
      await sleep(100);
    }
    if (!action || !await action.isVisible()) throw new Error(`${name} butonu yükleme durumundan çıkmadı.`);
    await action.click({ force: name === 'Onayla' });
    if (['Kaydet', 'Kapat'].includes(name)) return this.waitUntilSaved(original, 30000, name);
    const changeDeadline = Date.now() + (longAction ? 60000 : 15000);
    while (Date.now() < changeDeadline) {
      if (!await original.isVisible().catch(() => false)) return;
      const messages = await this.validationMessages();
      if (messages && await this.hasButton(name)) throw new Error(`${name} tıklandı fakat modal değişmedi. Mesaj: ${messages}`);
      const loading = await original.evaluate(dialog => Boolean(dialog.querySelector("button.v-btn--loading, button[aria-busy='true']")));
      if (!loading && await original.innerText() !== oldText) return;
      await sleep(100);
    }
    throw new Error(`${name} tıklandı fakat modal değişmedi.`);
  }
}

export { FaytModal, newWorkflowContext, vehiclePattern, fuelVehiclePattern };
