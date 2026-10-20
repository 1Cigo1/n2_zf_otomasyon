from datetime import datetime, timedelta
from playwright.sync_api import expect

class TarihSec:
    def __init__(self, page):
        self.page = page

    def tarih_ve_saat(self, reservation_type: str, ay_sayisi: int = 2):

        if reservation_type.lower() == "monthly":
            return self.aylik_tarih_ve_saat(ay_sayisi)
     
        bugun_obj = datetime.now()
        hedef_tarih_obj = bugun_obj + timedelta(days=7)

        bugun_str = bugun_obj.strftime("%d.%m.%Y 10:00")
        yedi_gun_sonrasi_str = hedef_tarih_obj.strftime("%d.%m.%Y 10:00")
        
     
        hedef_gun = str(hedef_tarih_obj.day)

        if reservation_type.lower() == "corporate":
            bitis_kutusu = self.page.get_by_placeholder("Rezervasyon Bitiş Tarihi")
            bitis_kutusu.click()
            self.page.wait_for_timeout(500) 
            self.page.get_by_role("button", name="Gelecek Ay").click()
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

    def aylik_tarih_ve_saat(self, ay_sayisi: int = 2):
        """Aylık formun mevcut başlangıcından 30 günlük dönemler oluşturur."""
        if ay_sayisi < 1:
            raise ValueError("Aylık rezervasyon için ay_sayisi en az 1 olmalı.")

        baslangic = self.page.get_by_placeholder("Başlangıç tarihi", exact=True)
        bitis = self.page.get_by_placeholder("Bitiş tarihi", exact=True)
        baslangic_metni = baslangic.input_value().strip()
        if not baslangic_metni:
            raise AssertionError("Aylık formda başlangıç tarihi boş.")

        baslangic_tarihi = datetime.strptime(baslangic_metni, "%d.%m.%Y")
        bitis_metni = (
            baslangic_tarihi + timedelta(days=30 * ay_sayisi)
        ).strftime("%d.%m.%Y")
        bitis.fill(bitis_metni)
        bitis.press("Tab")
        expect(bitis).to_have_value(bitis_metni)

        baslangic_saati = self.page.get_by_placeholder(
            "Başlangıç saati", exact=True
        ).input_value().strip()
        if baslangic_saati:
            bitis_saati = self.page.get_by_placeholder("Bitiş saati", exact=True)
            bitis_saati.fill(baslangic_saati)
            bitis_saati.press("Tab")
            expect(bitis_saati).to_have_value(baslangic_saati)

        print(f"Aylık dönem: {baslangic_metni} - {bitis_metni}")
        return bitis_metni
