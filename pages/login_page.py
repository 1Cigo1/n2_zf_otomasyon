from playwright.sync_api import expect

from pages.base_page import BasePage
from utils.config_reader import Config


class LoginPage(BasePage):
    def __init__(self, page):
        super().__init__(page)
        self.email_input = page.get_by_role(
            "textbox", name="E-posta adresinizi giriniz"
        )
        self.password_input = page.get_by_role(
            "textbox", name="Parolanızı giriniz"
        )
        self.login_button = page.get_by_role("button", name="Giriş Yap")

    def akilli_giris_yap(self):
        """Gecikmeli login yönlendirmesini bekler ve temiz oturumda giriş yapar."""
        self.page.wait_for_load_state("domcontentloaded")
        Config.validate_login()

        # Ana URL önce açılıp yaklaşık bir saniye sonra /auth/login'e yönleniyor.
        # URL'yi hemen kontrol etmek giriş adımının yanlışlıkla atlanmasına neden olur.
        expect(self.email_input).to_be_visible(timeout=30_000)
        self.email_input.fill(Config.EMAIL)
        self.password_input.fill(Config.PASSWORD)
        self.login_button.click()
        self.page.wait_for_url(
            lambda url: "login" not in url.lower(),
            timeout=30_000,
            wait_until="domcontentloaded",
        )
