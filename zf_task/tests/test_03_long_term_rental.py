# tests/test_04_long_term_rental.py
import re
import pytest
from pages.login_page import LoginPage
from pages.dashboard_page import DashboardPage
from pages.long_term_reservation import LongTermReservation
from utils.config_reader import Config
from playwright.sync_api import expect

class TestLongTermRental:

    def test_uzun_donem_kiralama_menusu(self,clean_page):
       
        clean_page.goto(Config.BASE_URL) # Gerekirse URL'i /dashboard olarak değiştirebilirsin
        
        login_sayfasi = LoginPage(clean_page)
        login_sayfasi.akilli_giris_yap()

        dashboard = DashboardPage(clean_page)
        dashboard.click_uzun_donem_menu()

        long_reservation = LongTermReservation(clean_page)
        long_reservation.go_to_yeni()
        
        long_reservation.yeni_sozlesme()

        long_reservation.sozlesme_incele()

        long_reservation.arac_grup()
        
        clean_page.pause()


        
    """

    """
    