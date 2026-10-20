from pages.login_page import LoginPage
from pages.dashboard_page import DashboardPage
from pages.long_term_reservation import LongTermReservation
from utils.config_reader import Config

class TestLongTermRental:

    def test_uzun_donem_kiralama_menusu(self, clean_page, step):
        step("Dev uzun dönem uygulaması açılıyor")
        clean_page.goto(Config.BASE_URL) # Gerekirse URL'i /dashboard olarak değiştirebilirsin

        login_sayfasi = LoginPage(clean_page)
        login_sayfasi.akilli_giris_yap()
        step("Uzun dönem kullanıcısıyla giriş başarılı")

        dashboard = DashboardPage(clean_page)
        dashboard.click_uzun_donem_menu()
        step("Uzun dönem kiralama menüsü açıldı")

        long_reservation = LongTermReservation(clean_page)
        long_reservation.go_to_yeni()
        step("Yeni uzun dönem sözleşme formu açıldı")

        long_reservation.yeni_sozlesme()
        step("Uzun dönem sözleşmesi oluşturuldu")

        long_reservation.sozlesme_incele(Config.E2E_CUSTOMER_NAME)
        step("Oluşturulan sözleşme müşteriyle bulundu")

        long_reservation.arac_grup(Config.E2E_VEHICLE_GROUP)
        step("Araç grubu seçildi")

        long_reservation.ilerle_rez()
        step("Uzun dönem rezervasyonu ilerletildi")

        dashboard.logout_click()
        step("Oturum kapatıldı; uzun dönem akışı başarılı")
