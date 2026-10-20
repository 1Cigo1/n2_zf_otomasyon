from pages.dashboard_page import DashboardPage
from pages.fayt_pages import FaytPage
from pages.login_page import LoginPage
from utils.config_reader import Config


class TestStandartYikama:
    def test_standart_yikama_flow(self, clean_page, step):
        step("Validation araç yıkama uygulaması açılıyor")
        clean_page.goto(
            Config.BASE_URL,
            wait_until="domcontentloaded",
            timeout=60_000,
        )

        LoginPage(clean_page).akilli_giris_yap()
        step("Validation kısa dönem kullanıcısıyla giriş başarılı")

        DashboardPage(clean_page).go_to_fayt()
        step("FAYT modülü açıldı")

        context = FaytPage(clean_page).standart_yikama()
        step("Standart yıkama talebi oluşturuldu ve workflow ilerletildi")

        assert context.selected_plate, "Yıkama talebinde araç seçilmedi."
        step(f"Talep aracı doğrulandı: {context.selected_plate}")
        assert context.values.get("washing_close_filled") == "true"
        step("Yıkama kapatma formu dolduruldu")
        assert context.request_closed, "Yıkama talebi kapatılamadı."
        step("Araç yıkama talebi başarıyla kapatıldı")
