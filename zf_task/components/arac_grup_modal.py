

class AracGrupModal:
    def __init__(self ,page):
        self.page = page

    def grup_olustur(self):

            ofis=self.page.get_by_role("textbox", name="İlgili Ofis İlgili Ofis")
            ofis.click()
            self.page.wait_for_timeout(500)
            self.page.get_by_role("option").first.click()

            aylik_fiyat=self.page.get_by_role("spinbutton", name="Aylık fiyat (KDV Hariç) Aylık")
            aylik_fiyat.click()
            aylik_fiyat.fill("23400000")
            self.page.wait_for_timeout(1000)

            arac_baslik=self. page.get_by_role("textbox", name="Araç Grubu Başlığı Araç Grubu")
            arac_baslik.click()
            arac_baslik.fill("cmad")
            self.page.wait_for_timeout(1000)

            arac_aciklama=self.page.get_by_role("textbox", name="Araç Grubu Açıklaması Araç")
            arac_aciklama.click()
            arac_aciklama.fill("yeni arac grubu")
            self.page.wait_for_timeout(1000)

            modal_kaydet_butonu=self.page.get_by_role("button", name="Kaydet")
            modal_kaydet_butonu.click()
            self.page.wait_for_timeout(1000)







"""
            page.get_by_role("spinbutton", name="Aylık fiyat (KDV Hariç) Aylık").click()
            page.get_by_role("spinbutton", name="Aylık fiyat (KDV Hariç) Aylık").fill("200000000")
            page.get_by_role("textbox", name="Araç Grubu Başlığı Araç Grubu").click()
            page.get_by_role("textbox", name="Araç Grubu Başlığı Araç Grubu").fill("cm")
            page.get_by_role("textbox", name="Araç Grubu Başlığı Araç Grubu").press("CapsLock")
            page.get_by_role("textbox", name="Araç Grubu Başlığı Araç Grubu").press("CapsLock")
            page.get_by_role("textbox", name="Araç Grubu Başlığı Araç Grubu").fill("cmad")
            page.get_by_role("textbox", name="Araç Grubu Açıklaması Araç").click()
"""            