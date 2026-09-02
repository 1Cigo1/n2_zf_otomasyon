import re
from utils.config_reader import Config
from pages.login_page import LoginPage
from pages.dashboard_page import DashboardPage
from pages.reservation_page import ReservationPage
from pages.edit_process_page import EditProcessPage
from pages.Vehicle_condition import VehicleConditionPage

from playwright.sync_api import expect

def test_navigate_and_select_calendar_range(clean_page):
   
    clean_page.goto(Config.BASE_URL)

    login_sayfasi = LoginPage(clean_page)
    login_sayfasi.akilli_giris_yap()
    
    dashboard = DashboardPage(clean_page)
    random_kimlik = dashboard.mono_menu()
    dashboard.click_reservation_menu()
    
    reservation_page = ReservationPage(clean_page)

    reservation_page.go_to_new()
    #reservation_page.go_to_calendar()
    #reservation_page.select_random_date_range_and_proceed()
    expect(clean_page).to_have_url(re.compile(r"/reservation/edit-vehicle-process"), timeout=15000)

    edit_page = EditProcessPage(clean_page)
    edit_page.islemleri_tamamla(random_kimlik, reservation_type=" ")

    
    conditionPage=VehicleConditionPage(clean_page)
    conditionPage.vehicle_reporty()
    
   
    dashboard.iade_menu(random_kimlik)
  
    conditionPage.vehicle_return_form()
    

    dashboard.logout_click()
        
  
   