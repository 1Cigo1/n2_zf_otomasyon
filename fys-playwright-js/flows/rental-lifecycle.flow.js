import { RentalAgreementFlow } from '../components/reservations/rental-agreement.flow.js';
import { ReturnListPage } from '../pages/return-list.page.js';
import { VehicleDeliveryPage } from '../pages/vehicle-delivery.page.js';
import { VehicleReturnPage } from '../pages/vehicle-return.page.js';
import { advanceRentalStage } from '../support/rental-lifecycle-data.js';

/**
 * Kaydedilmiş normal veya kurumsal rezervasyonu tek ortak yaşam döngüsüyle
 * sözleşmeden iadeye taşır. Rezervasyon oluşturma bu sınıfın sorumluluğu
 * değildir; böylece iki rezervasyon formu aynı teslim/iade kodunu paylaşır.
 */
export class RentalLifecycleFlow {
  constructor(page, env) {
    this.page = page;
    this.env = env;
    const timeout = Math.max(env.actionTimeout, env.saveTimeout);
    this.agreement = new RentalAgreementFlow(page, { actionTimeout: timeout });
    this.delivery = new VehicleDeliveryPage(page, { timeout });
    this.returnList = new ReturnListPage(page, { timeout });
    this.vehicleReturn = new VehicleReturnPage(page, { timeout });
  }

  async complete(context) {
    if (context?.stage !== 'reservation-saved') {
      throw new Error('Yaşam döngüsü reservation-saved aşamasından başlamalı.');
    }
    const settings = this.env.rentalLifecycle;
    const requiresProvision = context.reservationType === 'standard';

    const agreement = await this.agreement.createUploadAndSend({
      requiresProvision,
      provisionAmount: settings.standardProvisionAmount,
    });
    context.agreement = {
      uploaded: Boolean(agreement.uploaded),
      fileName: agreement.uploaded?.fileName,
      provisionAmount: agreement.provisionAmount,
    };
    advanceRentalStage(context, 'agreement-uploaded');
    advanceRentalStage(context, 'sent-to-delivery');

    const delivery = await this.delivery.complete({
      damageNote: settings.deliveryDamage,
    });
    if (!delivery.plate) {
      throw new Error('Teslim formundan araç plakası okunamadı; iade satırı güvenle seçilemez.');
    }
    context.vehicle.plate = delivery.plate;
    advanceRentalStage(context, 'vehicle-rented');

    context.returnSelection = await this.returnList.openAndSelect({
      customerIdentity: context.customer.identity,
      vehiclePlate: context.vehicle.plate,
      reservationCode: context.reservation.code,
      reservationId: context.reservation.id,
    });
    advanceRentalStage(context, 'return-opened');

    const returned = await this.vehicleReturn.complete({
      kmIncrease: settings.returnKmIncrement,
      fuelAmount: settings.returnFuel,
      damageNote: settings.returnDamage,
    });
    Object.assign(context.vehicle, {
      deliveryKm: returned.deliveryKm,
      returnKm: returned.returnKm,
      returnFuel: returned.fuelAmount,
    });
    context.returnMode = returned.mode;
    advanceRentalStage(context, 'completed');
    return context;
  }
}
