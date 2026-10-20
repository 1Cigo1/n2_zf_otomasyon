from pages.dashboard_page import DashboardPage
from pages.fayt_pages import FaytPage
from pages.login_page import LoginPage
from utils.config_reader import Config


class TestKiralamaDonusuYakit:
    def test_kiralama_donusu_yakit_alma_flow(self, clean_page, step):
        step("Validation yakıt alma uygulaması açılıyor")
        clean_page.goto(
            Config.BASE_URL,
            wait_until="domcontentloaded",
            timeout=60_000,
        )

        LoginPage(clean_page).akilli_giris_yap()
        step("Validation kısa dönem kullanıcısıyla giriş başarılı")

        DashboardPage(clean_page).go_to_fayt()
        step("FAYT modülü açıldı")

        context = FaytPage(clean_page).kiralama_donusu_yakit_alma()
        step("Kiralama dönüşü yakıt alma talebi workflow boyunca ilerletildi")

        assert context.selected_plate, "Yakıt alma talebinde araç seçilmedi."
        step(f"Talep aracı doğrulandı: {context.selected_plate}")
        assert context.values.get("fuel_close_filled") == "true"
        step("Yakıt alma kapatma formunda KM ve yakıt doğrulandı")
        assert context.request_closed, "Yakıt alma talebi kapatılamadı."
        step("Kiralama dönüşü yakıt alma talebi başarıyla kapatıldı")