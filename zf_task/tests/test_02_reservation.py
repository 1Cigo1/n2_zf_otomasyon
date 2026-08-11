import re
from utils.config_reader import Config
from pages.login_page import LoginPage
from pages.dashboard_page import DashboardPage
from pages.reservation_page import ReservationPage
from pages.edit_process_page import EditProcessPage
from playwright.sync_api import expect

def test_navigate_and_select_calendar_range(clean_page):
    """
    takvim ekranına gittim, random bir aralık seçtirdim,
    işlemi gerçekleştir butonuna vastırdım
    """
    clean_page.goto(Config.BASE_URL)

    login_sayfasi = LoginPage(clean_page)
    login_sayfasi.akilli_giris_yap()
    
    dashboard = DashboardPage(clean_page)
    dashboard.click_reservation_menu() 
    
    reservation_page = ReservationPage(clean_page)
    reservation_page.go_to_calendar()
    
    # sürükle bırak butona bs 
    
    reservation_page.select_random_date_range_and_proceed()
    

    # doğrulama yaptırttım yeni sayfa geçişi
    expect(clean_page).to_have_url(re.compile(r"/reservation/edit-vehicle-process"), timeout=15000)
    
    
  #  Müşteri TC'sini gir
    edit_page = EditProcessPage(clean_page)
    
    # TC numarasını Config'den (.env dosyasından) çekip metoda gönderiyoruz
    edit_page.select_customer(Config.E2E_CUSTOMER_IDENTITY_NO)

    edit_page.musteriEhliyet()

    edit_page.elle_arac_sec()

    edit_page.faturaAdresiSec()

    edit_page.kaydet()

    clean_page.pause()
    
   

    