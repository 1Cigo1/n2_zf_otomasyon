import { expect } from '@playwright/test';
import { exactText } from '../form.controls.js';
import {
  DEFAULT_CONTRACT_DOCUMENT,
  SingleFileUpload,
} from '../../support/file-upload.js';

const dialogSelector = '[role="dialog"]:visible';

export class RentalAgreementFlow {
  constructor(page, {
    root = page.locator('main'),
    actionTimeout = 30000,
    documentPath = DEFAULT_CONTRACT_DOCUMENT,
    uploader,
  } = {}) {
    this.page = page;
    this.root = root;
    this.actionTimeout = actionTimeout;
    this.documentPath = documentPath;
    this.uploader = uploader || new SingleFileUpload(page, {
      timeout: actionTimeout,
    });
  }

  async pageAction(name) {
    const action = this.root.getByRole('button', { name: exactText(name) });
    await expect(
      action,
      `${name}: sayfada tek bir işlem düğmesi olmalı`,
    ).toHaveCount(1, { timeout: this.actionTimeout });
    await expect(action).toBeVisible({ timeout: this.actionTimeout });
    await expect(action).toBeEnabled({ timeout: this.actionTimeout });
    return action;
  }

  async uploadContract(documentPath) {
    await (await this.pageAction('Sözleşme Yükle')).click();

    const uploadDialog = this.page.locator(dialogSelector).filter({
      has: this.page.locator('input[type="file"]'),
    });
    await expect(
      uploadDialog,
      'Sözleşme yükleme düğmesi tek bir dosya modalı açmalı',
    ).toHaveCount(1, { timeout: this.actionTimeout });

    return this.uploader.uploadAndSave(uploadDialog, {
      filePath: documentPath,
    });
  }

  async provisionSubmitButton(container) {
    const namedButton = container.getByRole('button', {
      name: /^(Onayla|Kaydet|Provizyon Al)$/i,
    });
    const namedCount = await namedButton.count();
    if (namedCount === 1) return namedButton;
    if (namedCount > 1) {
      throw new Error('Provizyon modalında birden fazla onay düğmesi bulundu.');
    }

    const greenButton = container.locator(
      'button:has(.mdi-check):visible, '
      + 'button.text-success:visible, '
      + 'button.text-green:visible',
    );
    await expect(
      greenButton,
      'Provizyon alanının yanında Onayla veya tek bir yeşil işlem düğmesi olmalı',
    ).toHaveCount(1, { timeout: this.actionTimeout });
    return greenButton;
  }

  async provisionControls() {
    const amountInput = this.root.getByRole('spinbutton', {
      name: /^Provizyon Tutarı(?: Provizyon Tutarı)?$/i,
    });
    await expect(
      amountInput,
      'Sayfada tek bir görünür provizyon tutarı alanı açılmalı',
    ).toHaveCount(1, { timeout: this.actionTimeout });
    await expect(amountInput).toBeVisible({ timeout: this.actionTimeout });
    await expect(amountInput).toBeEnabled({ timeout: this.actionTimeout });

    const dialog = this.page.locator(dialogSelector).filter({
      has: amountInput,
    });
    const dialogCount = await dialog.count();
    if (dialogCount > 1) {
      throw new Error('Provizyon alanını içeren birden fazla modal bulundu.');
    }

    // Uygulamanın güncel sürümünde alan bir modal yerine Özet kartında
    // satır içi açılıyor. En yakın düğmeli kapsayıcı kırmızı iptal ve yeşil
    // onay düğmelerini birlikte tutar. Eski modal görünümü de desteklenir.
    const container = dialogCount === 1
      ? dialog
      : amountInput.locator('xpath=ancestor::*[.//button][1]');
    await expect(
      container,
      'Provizyon alanı ve işlem düğmelerinin ortak kapsayıcısı bulunmalı',
    ).toHaveCount(1, { timeout: this.actionTimeout });

    return { amountInput, container };
  }

  async takeProvision(amount = '0') {
    await (await this.pageAction('Provizyon Al')).click();

    const { amountInput, container } = await this.provisionControls();
    await amountInput.fill(String(amount));
    await amountInput.press('Tab');
    await expect(amountInput).toHaveValue(String(amount));

    const originalAmountInput = await amountInput.elementHandle();
    if (!originalAmountInput) {
      throw new Error('Provizyon tutarı alanı DOM üzerinde bulunamadı.');
    }

    try {
      const submit = await this.provisionSubmitButton(container);
      await expect(submit).toBeEnabled();
      await submit.click();

      const confirmationDialog = this.page.locator(dialogSelector).filter({
        has: this.page.getByRole('button', { name: exactText('Evet') }),
      });
      await expect(
        confirmationDialog,
        'Provizyon onayından sonra Evet düğmeli tek bir doğrulama modalı açılmalı',
      ).toHaveCount(1, { timeout: this.actionTimeout });
      const yesButton = confirmationDialog.getByRole('button', {
        name: exactText('Evet'),
      });
      await expect(yesButton).toHaveCount(1);

      const originalConfirmationDialog = await confirmationDialog.elementHandle();
      if (!originalConfirmationDialog) {
        throw new Error('Provizyon doğrulama modalı DOM üzerinde bulunamadı.');
      }

      try {
        await yesButton.click();
        await expect.poll(
          () => originalConfirmationDialog.isVisible(),
          {
            message: 'Evet sonrasında provizyon doğrulama modalı kapanmalı',
            timeout: this.actionTimeout,
          },
        ).toBe(false);
        await expect.poll(
          () => originalAmountInput.isVisible(),
          {
            message: 'Evet sonrasında satır içi provizyon alanı kapanmalı',
            timeout: this.actionTimeout,
          },
        ).toBe(false);
      } finally {
        await originalConfirmationDialog.dispose();
      }
    } finally {
      await originalAmountInput.dispose();
    }
  }

  async sendToDelivery() {
    // Ön kontrol reddederse teslim alanını beklemek yerine API'nin nedenini göster.
    let rejectionMessage = '';
    const checkResponse = async response => {
      if (!new URL(response.url()).pathname.endsWith('/delivery-precheck/')) return;
      if (response.status() !== 200) {
        rejectionMessage = `Teslim ön kontrolü HTTP ${response.status()} döndürdü.`;
        return;
      }
      try {
        const result = await response.json();
        if (result.can_navigate === false || result.status === false) {
          const issues = Array.isArray(result.issues) ? result.issues : [];
          rejectionMessage = issues.map(issue => issue.message).filter(Boolean).join(' ')
            || 'Teslim ön kontrolü yönlendirmeye izin vermedi.';
        }
      } catch {
        rejectionMessage = 'Teslim ön kontrolünün JSON yanıtı okunamadı.';
      }
    };

    this.page.on('response', checkResponse);
    try {
      await (await this.pageAction('Teslimata Yönlendir')).click();
      const damage = this.page.getByRole('textbox', {
        name: /^Teslim Hasar Detayı(?: Teslim(?: Hasar Detayı)?)?$/i,
      }).filter({ visible: true });
      // Doğrudan teslim formu açan sürümler de bu kontrolden geçebilir.
      await expect.poll(async () => {
        if (rejectionMessage) return 'rejected';
        return await damage.count() > 0 ? 'ready' : 'waiting';
      }, {
        timeout: this.actionTimeout,
        message: 'Teslim ön kontrolü sonuçlanmalı ve teslim formu açılmalı',
      }).not.toBe('waiting');
      if (rejectionMessage) {
        throw new Error(`Teslimata yönlendirme reddedildi: ${rejectionMessage}`);
      }
    } finally {
      this.page.off('response', checkResponse);
    }
  }

  async createUploadAndSend({
    requiresProvision,
    provisionAmount = '0',
    documentPath = this.documentPath,
  } = {}) {
    if (typeof requiresProvision !== 'boolean') {
      throw new TypeError(
        'requiresProvision kısa dönem için true, kurumsal kısa dönem için false verilmelidir.',
      );
    }

    await (await this.pageAction('Sözleşme oluştur')).click();
    const uploaded = await this.uploadContract(documentPath);

    if (requiresProvision) {
      await this.takeProvision(provisionAmount);
    }

    await this.sendToDelivery();
    return {
      uploaded,
      provisionAmount: requiresProvision ? String(provisionAmount) : null,
    };
  }
}
