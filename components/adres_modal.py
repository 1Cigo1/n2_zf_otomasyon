
import re

class AdresModal:
    def __init__(self, page):
        self.page = page
    
    def formu_doldur_ve_kaydet(self):

        isim_input = self.page.locator("label").filter(has_text=re.compile(r"^İsim$", re.IGNORECASE)).locator("xpath=..//input")
        isim_input.fill("cihan")
        self.page.wait_for_timeout(500)

    
        soyisim_input = self.page.locator("label").filter(has_text="Soyisim").locator("xpath=..//input")
        soyisim_input.fill("Tus")
        self.page.wait_for_timeout(500)


        kimlik_input = self.page.locator("label").filter(has_text="Kimlik No").locator("xpath=..//input")
        kimlik_input.fill("11111111111")
        self.page.wait_for_timeout(500)

        
        eposta_input = self.page.locator("label").filter(has_text="E-Posta").locator("xpath=..//input")
        eposta_input.fill("test@otomasyon.com")
        self.page.wait_for_timeout(500)

    
        telefon_input = self.page.locator("label").filter(has_text="Telefon").locator("xpath=..//input")
        telefon_input.fill("5554443322")
        self.page.wait_for_timeout(500)

    
        il_kutu= self.page.get_by_role('textbox',  name ='İl İl' )
        #il_kutu = self.page.locator("label").filter(has_text=re.compile(r"^İl$", re.IGNORECASE)).locator("xpath=..").first
        il_kutu.click(force=True)
        self.page.wait_for_timeout(1000)
        ankara_secenegi = self.page.locator("text=Ankara").last
        ankara_secenegi.click(force=True)
        self.page.wait_for_timeout(1000)

        ilce_kutu= self.page.get_by_role('textbox',  name ='İlçe İlçe' )
        ilce_kutu.click(force=True)
        self.page.wait_for_timeout(1000)
        ankara_secenegi = self.page.locator("text=Yenimahalle").last
        ankara_secenegi.click(force=True)
        self.page.wait_for_timeout(1000)



        adres_input = self.page.locator("label").filter(has_text="Adres").locator("xpath=..//textarea")
        adres_input.fill("Next Level AVM, Çankaya, Ankara")
        self.page.wait_for_timeout(1000)

    
        adres_kaydet_butonu = self.page.locator("button").filter(has_text="KAYDET").last
        adres_kaydet_butonu.click(force=True)
        self.page.wait_for_timeout(1000)
    
        kaydet_butonu = self.page.locator("button").filter(has_text="EVET, KAYDET").last
        kaydet_butonu.click(force=True)
        self.page.wait_for_timeout(1000)

        self.page.get_by_role("button", name="Adresi Seç").click()
        self.page.wait_for_timeout(1000)    
