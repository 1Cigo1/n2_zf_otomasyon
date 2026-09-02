
from pages.edit_process_page import EditProcessPage



class CorporateReservationPage(EditProcessPage):
    def __init__(self, page):
        super().__init__(page)

        self.kurumsal_btn=page.get_by_role("link", name="󱔗 Kurumsal Kısa Dönem")
        self.rezervasyon_yap_btn=page.get_by_role("button", name="Rezervasyon Yap")
        self.devam_et_btn=page.get_by_role("button", name="Devam Et")

    def select_rezeration(self,contract_number):

        self.kurumsal_btn.click()
        self.page.wait_for_selector("table tbody tr") 
        hedef_satir = self.page.locator("table tbody tr").filter(has_text=contract_number).first
        hedef_satir.dblclick()

        self.rezervasyon_yap_btn.click()
        self.page.wait_for_timeout(1000)

        self.devam_et_btn.click()
        self.page.wait_for_timeout(1000)

        
        

