from pages.base_page import BasePage
from components.uzun_donem_kiralama_modal import UzunDonemModal
from components.arac_grup_modal import AracGrupModal
from components.arac_sec_modal import AracSecModal

class LongTermReservation(BasePage):
    def __init__(self, page):
        super().__init__(page)

        
        self.yeni_btn = page.get_by_role("button", name="Yeni" ,exact=True)
        self.table_rows = page.locator("table tbody tr")
        self.yeni_arac_grubu_text = page.get_by_text("Yeni arac grubu").first
        self.kiralanan_araclar_link = page.get_by_role("link", name="Kiralanan Araçlar")

    def go_to_yeni(self):

        self.click_element(self.yeni_btn)

    def yeni_sozlesme(self):
        
        self.page.wait_for_timeout(1000)
        sözleşme_modal=UzunDonemModal(self.page)
        sözleşme_modal.uzunKaydet()

    def sozlesme_incele(self, customer_id):

        self.page.wait_for_selector("table tbody tr") 
        hedef_satir = self.table_rows.filter(has_text=customer_id).first
        hedef_satir.dblclick()

    def arac_grup(self, arac_basligi):

        self.yeni_btn.click(force=True)
        self.page.wait_for_timeout(1000)
        aracModal = AracGrupModal(self.page)
        aracModal.grup_olustur(arac_basligi)    

    def ilerle_rez(self):

        self.page.wait_for_timeout(1000)
        self.yeni_arac_grubu_text.dblclick()
        self.page.wait_for_timeout(1000)
        self.kiralanan_araclar_link.click()
        self.click_element(self.yeni_btn)
        aracSecModal = AracSecModal(self.page)
        aracSecModal.arac_sec()




        
