
import re
from pages.login_page import LoginPage
from pages.dashboard_page import DashboardPage
from pages.corporate_reservation_page import CorporateReservationPage
from pages.edit_process_page import EditProcessPage
from utils.config_reader import Config
from pages.Vehicle_condition import VehicleConditionPage
from playwright.sync_api import expect

class TestCorporateReservation:

    def test_corporate_reservation_flow(self, clean_page, step):
        step("Dev kurumsal kısa dönem uygulaması açılıyor")
        clean_page.goto(Config.BASE_URL)

        login_sayfasi = LoginPage(clean_page)
        login_sayfasi.akilli_giris_yap()
        step("Kısa dönem kullanıcısıyla giriş başarılı")

        dashboard = DashboardPage(clean_page)
        dashboard.click_reservation_menu()
        step("Kurumsal kısa dönem rezervasyon listesi açıldı")

        the_corporate_reservation_page = CorporateReservationPage(clean_page)

        the_corporate_reservation_page.select_rezeration(Config.E2E_CONTRACT_NUMBER)
        step("Tanımlı sözleşme numarasıyla müşteri seçildi")

        edit_page = EditProcessPage(clean_page)

        secilen_ek_hizmet = edit_page.islemleri_tamamla(
            Config.E2E_CUSTOMER_IDENTITY_NO,
            reservation_type="Corporate",
        )
        assert secilen_ek_hizmet, "Kurumsal kısa dönem için ek hizmet seçilemedi."
        step(f"Rezervasyon kaydedildi; ek hizmet seçildi: {secilen_ek_hizmet}")

        expect(clean_page).to_have_url(re.compile(r"corporate-reservation"), timeout=15000)
        conditionPage=VehicleConditionPage(clean_page)
        conditionPage.vehicle_reporty()
        step("Araç teslim formu tamamlandı")

        dashboard.iade_menu(Config.E2E_CUSTOMER_IDENTITY_NO)
        step("Kurumsal müşteri iade listesinde bulundu")
        conditionPage.vehicle_return_form()

        expect(clean_page).to_have_url(re.compile(r"/reservation/delivery-list(?:\?|$)"),timeout=1200000)
