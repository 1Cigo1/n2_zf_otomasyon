from datetime import datetime, timedelta

class TarihSec:
    def __init__(self, page):
        self.page = page

    def tarih_ve_saat(self, reservation_type: str):
     
        bugun_obj = datetime.now()
        hedef_tarih_obj = bugun_obj + timedelta(days=7)

        bugun_str = bugun_obj.strftime("%d.%m.%Y 10:00")
        yedi_gun_sonrasi_str = hedef_tarih_obj.strftime("%d.%m.%Y 10:00")
        
     
        hedef_gun = str(hedef_tarih_obj.day)

        if reservation_type.lower() == "corporate":
            bitis_kutusu = self.page.get_by_placeholder("Rezervasyon Bitiş Tarihi")
            bitis_kutusu.click()
            self.page.wait_for_timeout(500) 

        
            if hedef_tarih_obj.month != bugun_obj.month:
                print("Ay değişimi tespit edildi. Sonraki aya geçiliyor...")
                self.page.get_by_role("button", name="Gelecek Ay").click()
                self.page.wait_for_timeout(500) 

           
            self.page.locator("td:not(.p-datepicker-other-month)").get_by_text(hedef_gun, exact=True).click(force=True)
            
            self.page.get_by_role("combobox", name="Rezervasyon Başlangıç Saati").click()
            self.page.get_by_role("button", name="Gelecek Dakika ").first.click()
            self.page.get_by_role("combobox", name="Rezervasyon Başlangıç Saati").press("Tab")
            
            self.page.get_by_role("combobox", name="Rezervasyon Bitiş Saati").click()
            self.page.get_by_role("button", name="Gelecek Saat").first.click()
            
        else:       
            
            baslangic_kutusu = self.page.get_by_placeholder("Rezervasyon Başlangıç Tarihi")
            baslangic_kutusu.click()
            baslangic_kutusu.fill(bugun_str)
            self.page.keyboard.press("Escape") 
            self.page.wait_for_timeout(500)
            
            bitis_kutusu = self.page.get_by_placeholder("Rezervasyon Bitiş Tarihi")
            bitis_kutusu.click()
            bitis_kutusu.fill(yedi_gun_sonrasi_str)
            self.page.keyboard.press("Escape")
            self.page.wait_for_timeout(500)
            
            self.page.get_by_role("combobox", name="Rezervasyon Başlangıç Saati").click()
            self.page.get_by_role("button", name="Gelecek Dakika ").first.click()
            self.page.get_by_role("combobox", name="Rezervasyon Başlangıç Saati").press("Tab")
            
            self.page.get_by_role("combobox", name="Rezervasyon Bitiş Saati").click()
            self.page.get_by_role("button", name="Gelecek Saat").first.click()
           