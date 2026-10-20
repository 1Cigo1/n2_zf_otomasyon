import re
from utils.config_reader import Config
from pages.login_page import LoginPage
from pages.dashboard_page import DashboardPage
from pages.reservation_page import ReservationPage
from pages.edit_process_page import EditProcessPage
from pages.Vehicle_condition import VehicleConditionPage

from playwright.sync_api import expect

def test_navigate_and_select_calendar_range(clean_page, step):
    step("Dev kısa dönem uygulaması açılıyor")
    clean_page.goto(Config.BASE_URL)

    login_sayfasi = LoginPage(clean_page)
    login_sayfasi.akilli_giris_yap()
    step("Kısa dönem kullanıcısıyla giriş başarılı")

    dashboard = DashboardPage(clean_page)
    random_kimlik = dashboard.mono_menu()
    step("Mono müşterisi oluşturuldu")
    dashboard.click_reservation_menu()
    step("Kısa dönem rezervasyon listesi açıldı")

    reservation_page = ReservationPage(clean_page)

    reservation_page.go_to_new()
    expect(clean_page).to_have_url(re.compile(r"/reservation/edit-vehicle-process"), timeout=15000)
    step("Yeni rezervasyon formu açıldı")

    edit_page = EditProcessPage(clean_page)
    edit_page.islemleri_tamamla(random_kimlik, reservation_type=" ")
    step("Rezervasyon bilgileri, ek hizmet ve sözleşme işlemleri tamamlandı")

    conditionPage=VehicleConditionPage(clean_page)
    conditionPage.vehicle_reporty()
    step("Araç teslim formu tamamlandı")

    dashboard.iade_menu(random_kimlik)
    step("Müşteri iade listesinde bulundu")

    conditionPage.vehicle_return_form()
    step("Araç iade formu tamamlandı")

    dashboard.logout_click()
    step("Oturum kapatıldı; kısa dönem akışı başarılı")
