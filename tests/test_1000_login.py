import re

from pages.login_page import LoginPage
from pages.dashboard_page import DashboardPage
from utils.config_reader import Config
from playwright.sync_api import expect


def test_login(clean_page, step):
    Config.validate_login()
    step(f"{Config.ENVIRONMENT} ortamı giriş sayfası açılıyor")
    clean_page.goto(Config.BASE_URL, wait_until="domcontentloaded")

    LoginPage(clean_page).akilli_giris_yap()
    step(f"{Config.ACTIVE_ROLE} kullanıcısıyla giriş başarılı")

    expect(clean_page).not_to_have_url(
        re.compile(r"/login(?:[/?#]|$)", re.IGNORECASE),
        timeout=15_000,
    )
    step("Login doğrulaması tamamlandı")

    DashboardPage(clean_page).logout_click()
    expect(clean_page).to_have_url(
        re.compile(r"/auth/login(?:[/?#]|$)", re.IGNORECASE),
        timeout=30_000,
    )
    step("Logout doğrulaması tamamlandı")
