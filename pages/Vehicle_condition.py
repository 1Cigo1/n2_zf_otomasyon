import os
from pages.base_page import BasePage
from components.dosya_yükle import GenelDosyaYukleyici

class VehicleConditionPage(BasePage):

    def __init__(self, page):
        super().__init__(page)

        self.teslimHasar=page.get_by_role("textbox", name="Teslim Hasar Detayı Teslim")
        self.formKaydet=page.get_by_role("button", name="Form Bilgilerini Kaydet")
        self.formYukle=  page.get_by_role("button", name="Formu Yükle")
        self.kirayaYönlendir=page.get_by_role("button", name="Kiraya Yönlendir")
        self.iadeHasar= page.get_by_role("textbox", name="İade Hasar Detayı İade Hasar")      
        self.yukle=GenelDosyaYukleyici(self.page)
        self.tamam= page.get_by_role("button", name="Tamam")
        self.ileri=page.get_by_role("button", name="İLERİ")

    def vehicle_reporty(self):

        self.teslimHasar.click()
        self.teslimHasar.fill("aracın bir hasarı bulunmamıştır")
        self.formKaydet.click()
        self.formYukle.click()
        self.yukle.tekli_dosya_yukle("Ekran Resmi 2026-08-17 16.53.56.png")
        self.kirayaYönlendir.click()
        self.yukle.coklu_yukle(["egea_arka.jpeg" ,"egea_iç.jpg", "egea_ön.jpg", "egea_ön1.jpeg" ,"egea_sağ.jpg" ,"egea_sol.jpg"])
        

    def vehicle_return_form(self):

        teslim_km_kutusu = self.page.locator("input.v-field__input[disabled][type='number']").first
        self.page.wait_for_timeout(2000)
        teslim_km_metni = teslim_km_kutusu.input_value().strip()
        yeni_iade_km = int(teslim_km_metni) + 30
        self.page.wait_for_timeout(3000)
        self.page.keyboard.press("Tab")
        self.page.wait_for_timeout(300)
        self.page.keyboard.type(str(yeni_iade_km), delay=200)
        self.page.wait_for_timeout(1000)
        self.page.keyboard.press("Tab")
        self.page.wait_for_timeout(300)
        self.page.keyboard.type("2", delay=50)
        self.page.wait_for_timeout(300)
        self.iadeHasar.click()
        self.iadeHasar.fill("aracın yeni hasarı yok")
        self.formKaydet.click()
        self.page.wait_for_timeout(1000)
        
        try:
            self.tamam.wait_for(state="visible", timeout=2000)
            self.tamam.click()
        except:
            pass
        self.page.wait_for_timeout(1000)
        self.formYukle.click()
        self.page.wait_for_timeout(1000)
        self.yukle.tekli_dosya_yukle("Ekran Resmi 2026-08-17 16.53.56.png")
        self. page.get_by_role("button", name="Tamamla").click()
        self.ileri.click()
        self.yukle.coklu_yukle(["egea_arka.jpeg" ,"egea_iç.jpg", "egea_ön.jpg", "egea_ön1.jpeg" ,"egea_sağ.jpg" ,"egea_sol.jpg"])
        self.page.wait_for_timeout(1000)
        self.ileri.first.click()
        self.page.wait_for_timeout(1000)
        self.page.get_by_role("radio", name="Normal Yıkama").check()

        self.ileri.first.click()
        self.page.wait_for_timeout(1000)

        self.page.get_by_role("radio", name="Yakıt Alınacak").check()
        self.page.get_by_role("button", name="Kaydet").click()


