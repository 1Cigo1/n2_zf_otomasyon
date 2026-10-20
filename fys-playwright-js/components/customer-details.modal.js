import { DriverLicenseModal } from './reservations/driver-license.modal.js';
import { BillingAddressModal } from './reservations/billing-address.modal.js';

// Geriye uyumluluk katmanı. Yeni kod doğrudan iki ayrı modalı kullanır.
export class CustomerDetailsModal {
  constructor(page) {
    this.license = new DriverLicenseModal(page);
    this.billingAddress = new BillingAddressModal(page);
  }

  async fillLicense(customer) {
    await this.license.fill(customer);
  }

  async fillBillingAddress(customer) {
    await this.billingAddress.fill(customer);
  }
}
