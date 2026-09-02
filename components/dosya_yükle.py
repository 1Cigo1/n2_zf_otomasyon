import os

class GenelDosyaYukleyici:
    def __init__(self, page):
        self.page = page
        
        self.yukleme_ikonu = page.locator(".mdi-paperclip").first
        #self.gizli_input = page.locator("input[type='file']").first
        self.kaydet_butonu = page.get_by_role("button", name="Kaydet", exact=True).first

    def tekli_dosya_yukle(self, dosya_adi: str):

        dosya_yolu = os.path.join(os.getcwd(), "test_data", dosya_adi)

        with self.page.expect_file_chooser() as fc_info:
            
            self.yukleme_ikonu.click()

        dosya_secici = fc_info.value
        dosya_secici.set_files(dosya_yolu)

        #self.gizli_input.set_input_files(dosya_yolu)
        self.page.wait_for_timeout(1000) 
        self.kaydet_butonu.wait_for(state="visible", timeout=30000)
        self.kaydet_butonu.click()
        self.page.wait_for_timeout(1000)

    def coklu_yukle(self, dosya_listesi: list):

       
        tam_yollar = [os.path.join(os.getcwd(), "test_data", dosya) for dosya in dosya_listesi]

        with self.page.expect_file_chooser() as fc_info:
            self.yukleme_ikonu.click()

        dosya_secici = fc_info.value
        dosya_secici.set_files(tam_yollar)    

        self.page.wait_for_timeout(1000)
        
        # Kaydet butonunu ara - eğer yoksa devam et (form otomatik kapanabilir)
        try:
            self.kaydet_butonu.wait_for(state="visible", timeout=3000)
            self.kaydet_butonu.click()
        except Exception:
            # Kaydet butonu bulunmadı - form zaten tamamlanmış olabilir
            pass

