import re
import random

class MonoModal:

    def __init__(self,page):
        self.page=page

        self.randomKimlik=str(random.randint(10000000000, 99999999999))
        self.kimlikNo=page.get_by_role("textbox", name="Kimlik No Kimlik No")
        self.monoIsim= page.get_by_role("textbox", name="İsim")
        self.monoSoyisim=page.get_by_role("textbox", name="Soyisim")
        self.monoTipi=page.get_by_role("textbox", name="Mono Tipi")
        self.monoOpsiyon=self.page.get_by_role("option")
        self.monoKaynak=page.get_by_role("textbox", name="Mono Kaynağı")
        self.monoTarih=page.get_by_role("combobox", name="Doğum Tarihi")
        self.monoTel=page.get_by_role("textbox", name="Arama yap")
        self.monoText=page.get_by_text("+90")      
        self.monoTelNo=page.get_by_role("textbox", name="(999) 999 99")
        self.ornek_kutu = page.locator(".v-row.items-center > .v-col.v-col-6 input").first
        self.il_kutu=page.get_by_role('textbox',  name ='İl İl' )
        self.ilce_kutu= page.get_by_role('textbox',  name ='İlçe İlçe' )
        self.adres_input =page.locator("label").filter(has_text="Adres").locator("xpath=..//textarea")



    def mono_olustur(self):

        self.kimlikNo.click()
        self.kimlikNo.fill(self.randomKimlik)
        self.page.wait_for_timeout(1000)
        self.monoIsim.click()
        self.monoIsim.fill("ahmet")
        self.page.wait_for_timeout(1000)
        self.monoSoyisim.click()
        self.monoSoyisim.fill("kavlak")
        self.page.wait_for_timeout(1000)
        self.monoTipi.click()
        self.monoOpsiyon.first.click()
        self.page.wait_for_timeout(1000)
        self.monoKaynak.click()
        self.monoOpsiyon.first.click()
        self.page.wait_for_timeout(1000)
        self.monoTarih.click()
        self.monoTarih.fill("01.01.2000")
        self.page.wait_for_timeout(1000)
        self.monoTel.click()
        self.monoTel.fill("tur")
        self.monoText.click()
        self.page.wait_for_timeout(1000)
        self.monoTelNo.fill("5467890123")
        self.page.wait_for_timeout(1000)
        self.ornek_kutu.click()
        self.ornek_kutu.fill("testotomasyon@n2mobil.com.tr")
        self.page.wait_for_timeout(1000)
        self.il_kutu.click(force=True)
        self.page.wait_for_timeout(2000)
        ankara_secenegi = self.page.locator("text=Ankara").last
        ankara_secenegi.click(force=True)
        self.page.wait_for_timeout(500)
        self.ilce_kutu.click(force=True)
        self.page.wait_for_timeout(2000)
        ankara_secenegi = self.page.locator("text=Yenimahalle").last
        ankara_secenegi.click(force=True)
        self.page.wait_for_timeout(500)
        self.adres_input.fill("Next Level AVM, Çankaya, Ankara")
        self.page.wait_for_timeout(300)


        adres_kaydet_butonu = self.page.locator("button").filter(has_text="KAYDET").last
        adres_kaydet_butonu.click(force=True)
        self.page.wait_for_timeout(1500)


        kaydet_butonu = self.page.locator("button").filter(has_text="EVET, KAYDET").last
        kaydet_butonu.click(force=True)
        self.page.wait_for_timeout(1500)

        

        
