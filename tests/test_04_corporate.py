
import re
from pages.login_page import LoginPage
from pages.dashboard_page import DashboardPage
from pages.corporate_reservation_page import CorporateReservationPage
from pages.edit_process_page import EditProcessPage
from utils.config_reader import Config
from pages.Vehicle_condition import VehicleConditionPage
from playwright.sync_api import expect

class TestCorporateReservation:

    def test_corporate_reservation_flow(self, clean_page):

        clean_page.goto(Config.BASE_URL)

        login_sayfasi = LoginPage(clean_page)
        login_sayfasi.akilli_giris_yap()
        
        dashboard = DashboardPage(clean_page)
        dashboard.click_reservation_menu()

        the_corporate_reservation_page = CorporateReservationPage(clean_page)

        the_corporate_reservation_page.select_rezeration(Config.E2E_CONTRACT_NUMBER)

        edit_page = EditProcessPage(clean_page)

        edit_page.islemleri_tamamla(Config.E2E_CUSTOMER_IDENTITY_NO, reservation_type="Corporate")

        expect(clean_page).to_have_url(re.compile(r"corporate-reservation"), timeout=1500)
        conditionPage=VehicleConditionPage(clean_page)
        conditionPage.vehicle_reporty()
        
        dashboard.iade_menu(Config.E2E_CUSTOMER_IDENTITY_NO)
        conditionPage.vehicle_return_form()

        #dashboard.logout_click()

        clean_page.pause()