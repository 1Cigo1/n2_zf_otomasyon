import re

from pages.base_page import BasePage
from components.mona_modal import MonoModal
from playwright.sync_api import expect

class DashboardPage(BasePage):
    def __init__(self, page):
        super().__init__(page)
        
       #direk rezervasyon ikonunu buldurdum
        self.reservation_sidebar_icon = page.locator("a[href='/reservation']")
        self.uzun_donem_sidebar_icon = page.get_by_title("Uzun Dönem Kiralama")

    def click_reservation_menu(self):
       
        self.click_element(self.reservation_sidebar_icon)


    def click_uzun_donem_menu(self): 
        
        self.click_element(self.uzun_donem_sidebar_icon)
        self.page.wait_for_timeout(4000)
  
    def logout_click(self):
        # Açık bir dialog/scrim profil butonunun tıklanmasını engelleyebilir.
        expect(
            self.page.locator('.v-dialog[role="dialog"]:visible')
        ).to_have_count(0, timeout=15_000)
        expect(
            self.page.locator('.v-overlay__scrim:visible')
        ).to_have_count(0, timeout=15_000)

        ust_menu = self.page.locator("header, .v-toolbar").first
        expect(ust_menu).to_be_visible(timeout=15_000)

        profil_butonu = ust_menu.get_by_role("button").last
        expect(profil_butonu).to_be_visible(timeout=15_000)
        profil_butonu.click()

        # Sayfada gizli kopyalar bulunabildiği için yalnızca açılan Vuetify
        # menüsündeki çıkış seçeneğini kullan.
        aktif_menu = self.page.locator(".v-overlay--active").filter(
            has=self.page.get_by_text("Oturumu Kapat", exact=True)
        ).last
        expect(aktif_menu).to_be_visible(timeout=10_000)

        cikis_secenegi = aktif_menu.get_by_text("Oturumu Kapat", exact=True)
        expect(cikis_secenegi).to_be_visible(timeout=10_000)
        cikis_secenegi.click()

        expect(self.page).to_have_url(
            re.compile(r"/auth/login(?:[/?#]|$)", re.IGNORECASE),
            timeout=30_000,
        )
        expect(
            self.page.get_by_role(
                "textbox", name="E-posta adresinizi giriniz"
            )
        ).to_be_visible(timeout=15_000)
   

    def mono_menu(self):

        self.page.get_by_title("Mono Yönetimi").click()

        self.page.get_by_role("button", name="Yeni").click()
        mono_getir=MonoModal(self.page)
        mono_getir.mono_olustur()
        self.page.wait_for_timeout(4000)
       
        self.page.get_by_role("link", name="󰓎 Özel Tanımlı Müşteriler").click()
        self.page.wait_for_timeout(4000)
        self.page.get_by_role("button", name="Yeni").click()
        randomIsim=self.page.get_by_role("textbox", name="Müşteriler Müşteriler")
        randomIsim.fill(mono_getir.randomKimlik)
        self.page.get_by_role("option").first.click(force=True)
        self.page.wait_for_timeout(4000)
        self.page.keyboard.press("Tab")
        self.page.get_by_role("button", name="Kaydet").click()
        self.page.wait_for_timeout(4000)
        self.click_element(self.reservation_sidebar_icon)
        return mono_getir.randomKimlik


    def iade_menu(self,tc_number):

        self.page.get_by_role("link", name="󱮎 İade Alınacak Listesi").click()
        self.page.get_by_role("textbox", name="Herhangi bir şey arayın").click()
        self.page.get_by_role("textbox", name="Herhangi bir şey arayın").fill(tc_number)
       
        self. page.get_by_role("textbox", name="Herhangi bir şey arayın").press("Enter")
        self.page.wait_for_timeout(3000)
        self.page.locator("table tbody tr").first.locator(
            "button:has(i.mdi-file-sign)"
        ).click()
        expect(self.page).to_have_url(
            re.compile(r"/reservation/.*/return/"), timeout=30000
        )

    def go_to_fayt(self):

        self.page.get_by_title("Filo Araçları Yönetim").click()
        self.page.wait_for_timeout(1000)
