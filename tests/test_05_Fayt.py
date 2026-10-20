from utils.config_reader import Config
from pages.login_page import LoginPage
from pages.dashboard_page import DashboardPage
from pages.fayt_pages import FaytPage

class TestFayt:
    def test_fayt_flow(self, clean_page):

        clean_page.goto(Config.BASE_URL)

        login_sayfasi = LoginPage(clean_page)
        login_sayfasi.akilli_giris_yap()
        dashboard = DashboardPage(clean_page)
        dashboard.go_to_fayt()

        fayt_page = FaytPage(clean_page)

        context = fayt_page.ssh_arac_bakim()

        assert context.selected_plate, "Bakım talebinde araç seçilmedi."
