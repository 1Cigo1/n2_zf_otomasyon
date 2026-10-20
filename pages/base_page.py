from playwright.sync_api import Locator, Page, TimeoutError as PlaywrightTimeoutError, expect


class BasePage:
    def __init__(self, page: Page):
        self.page = page

    def navigate(self, path=""):
        from utils.config_reader import Config

        self.page.goto(f"{Config.BASE_URL}{path}")

    def click_element(self, locator: Locator):
        locator.wait_for(state="visible")
        locator.click()

    def fill_element(self, locator: Locator, text: str):
        locator.wait_for(state="visible")
        locator.fill(text)

    def is_element_visible(self, locator: Locator) -> bool:
        try:
            locator.wait_for(state="visible", timeout=6000)
            return locator.is_visible()
        except PlaywrightTimeoutError:
            return False

    def select_dropdown_option_by_text(self, dropdown_locator, option_text: str):
        """Vuetify dropdown'u açıp görünür seçeneği metnine göre seçer."""
        expect(dropdown_locator).to_be_visible(timeout=5000)
        dropdown_locator.click()

        menu = self.page.locator(".v-overlay.v-overlay--active .v-list")
        expect(menu).to_be_visible(timeout=5000)

        option = menu.get_by_text(option_text, exact=True)
        expect(option).to_be_visible(timeout=5000)
        option.click()
