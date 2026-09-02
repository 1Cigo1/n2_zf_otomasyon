from pages.base_page import BasePage
from components.mona_modal import MonoModal

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

        user_sila=self.page.get_by_role("button", name="S Sıla Ayas")
        user_baskan=self.page.get_by_role("button", name="B Barbaros Fuat Başkan")
        user_gülsüm=self.page.get_by_role("button", name="G Gülsün Aydın")
        user_silaDanisman= self.page.get_by_role("button", name="S Sıla (satış danışmanı) Ayas")
        user_sila.or_(user_baskan).or_(user_gülsüm).or_(user_silaDanisman).click()
        self.page.get_by_text("Oturumu Kapat").click()
   

    def mono_menu(self):

        self.page.get_by_title("Mono Yönetimi").click()

        self.page.get_by_role("button", name="Yeni").click()
        mono_getir=MonoModal(self.page)
        mono_getir.mono_olustur()
        self.page.wait_for_timeout(4000)
       
        self.page.get_by_role("link", name="󰓎 Özel Tanımlı Müşteriler").click()
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
        self.page.locator(".v-btn.v-theme--light.text-primary").first.click(force=True)