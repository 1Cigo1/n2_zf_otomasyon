import re

class UzunDonemModal:
    def __init__(self,page):
        self.page=page

    def uzunKaydet(self):

        musteri_label = self.page.get_by_role("dialog").get_by_role("button", name="Aç")
        musteri_label.locator("..").first.click(force=True)
        self.page.wait_for_timeout(500)
        self.page.get_by_role("option").first.click(force=True)

        sözlesme_ad=self. page.get_by_role("textbox", name="Sözleşme Adı Sözleşme Adı")
        sözlesme_ad.click()
        sözlesme_ad.fill("yeni sözleşme")
        self.page.wait_for_timeout(500)

        sözlesme_aciklama=self.page.get_by_role("textbox", name="Sözleşme Açıklaması Sözleşme")
        sözlesme_aciklama.click()
        sözlesme_aciklama.fill("sözleşme yapıldı")
        self.page.wait_for_timeout(500)

        söz_kyt_btn=self.page.get_by_role("button", name="Kaydet").click()
        self.page.wait_for_timeout(500)