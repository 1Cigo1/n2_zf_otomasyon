import re
from pages.base_page import BasePage
from components.uzun_dönem_kiralama_modal import UzunDonemModal
from components.arac_grup_modal import AracGrupModal

class LongTermReservation(BasePage):
    def __init__(self,page):
        super().__init__(page)

        self.yeni_btn=page.get_by_role("button", name="Yeni")
        self.incele_btn=page.locator("button").filter(has_text=re.compile(r"^Detay")).first

    def go_to_yeni(self):

        self.click_element(self.yeni_btn)


    def yeni_sozlesme(self):
        
        self.page.wait_for_timeout(1000)
        sözleşme_modal=UzunDonemModal(self.page)
        sözleşme_modal.uzunKaydet()


    def sozlesme_incele(self):

        self.page.wait_for_selector("table tbody tr") 
        ilk_satir = self.page.locator("table tbody tr").first
        ilk_satir.dblclick()
        btn=self.page.get_by_role("button", name="Yeni", exact=True)
        btn.click(force=True)

    def arac_grup(self):

        aracModal=AracGrupModal(self.page)
        aracModal.grup_olustur()    


        
