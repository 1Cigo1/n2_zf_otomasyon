import re

class EhliyetModal:
    def __init__(self, page):
        self.page = page

    def ehliyet_kaydet(self):


            
        dogum_yeri_label = self.page.locator("label").filter(has_text="Doğum Yeri (Ülke)")
        dogum_yeri_label.locator("..").first.click(force=True)
        self.page.keyboard.type("Turkey", delay=50) 
        self.page.wait_for_timeout(3000)
        self.page.get_by_role("option").first.click(force=True)
        
        self.page.wait_for_timeout(1000)
   
        
        
        il_label = self.page.locator("label").filter(has_text="Doğum Yeri (İl)")
        il_label.locator("..").first.click(force=True)
        self.page.wait_for_timeout(500)
        self.page.get_by_role("option").first.click(force=True)   
        
        self.page.wait_for_timeout(1000)
        
        
        ilce_label = self.page.locator("label").filter(has_text="Doğum Yeri (İlçe)")
        ilce_label.locator("..").first.click(force=True)
        self.page.wait_for_timeout(500)
        self.page.get_by_role("option").first.click(force=True)

        ehliyet_no_label = self.page.locator("label").filter(has_text=re.compile(r"^Ehliyet No$"))
        ehliyet_no_label.locator("..").locator("input").fill("123456789")
        self.page.keyboard.press("Tab")
        self.page.wait_for_timeout(500)

      
        ehliyet_tarih_input = self.page.get_by_placeholder("Ehliyet Veriliş Tarihi", exact=True)
        ehliyet_tarih_input.fill("01.01.2020")
        self.page.wait_for_timeout(3000)
        
        
        self.page.keyboard.press("Tab")
        self.page.wait_for_timeout(500)


      
        modal_kaydet_butonu = self.page.locator("button").filter(has_text="KAYDET").last
        modal_kaydet_butonu.click(force=True)
        self.page.wait_for_timeout(1000)
