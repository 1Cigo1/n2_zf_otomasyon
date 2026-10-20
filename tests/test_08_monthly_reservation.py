import re
from utils.config_reader import Config
from pages.login_page import LoginPage
from pages.dashboard_page import DashboardPage
from pages.reservation_page import ReservationPage
from pages.edit_process_page import EditProcessPage

from playwright.sync_api import expect


class TestMonthlyReservation:
    def test_monthly_reservation_flow(self, clean_page, step):
        step("Dev aylık rezervasyon uygulaması açılıyor")
        clean_page.goto(Config.BASE_URL)

        login_sayfasi = LoginPage(clean_page)
        login_sayfasi.akilli_giris_yap()
        step("Aylık rezervasyon kullanıcısıyla giriş başarılı")

        dashboard = DashboardPage(clean_page)
        dashboard.click_reservation_menu()
        step("Rezervasyon menüsü açıldı")

        reservation_page = ReservationPage(clean_page)
        reservation_page.go_to_monthly_reservation()
        step("Aylık rezervasyon listesi açıldı")
        reservation_page.go_to_new()
        expect(clean_page).to_have_url(
            re.compile(r"/reservation/monthly-reservation$"), timeout=15000
        )
        step("Yeni aylık rezervasyon formu açıldı")

        edit_page = EditProcessPage(clean_page)
        secilen_ek_hizmet = edit_page.islemleri_tamamla(
            Config.MONTHLY_CUSTOMER_IDENTITY_NO,
            reservation_type="Monthly",
        )
        assert secilen_ek_hizmet, "Aylık rezervasyonda ek hizmet seçilemedi."
        step("Aylık form dolduruldu ve rezervasyonları oluştur düğmesine basıldı")
        expect(clean_page).to_have_url(
            re.compile(r"/reservation/monthly-reservation-list"), timeout=30000
        )
        step("Aylık rezervasyon listesine dönüldü")
