import re
from pages.base_page import BasePage
from components.adres_modal import AdresModal
from components.ehliyet_modal import EhliyetModal

class EditProcessPage(BasePage):
    def __init__(self, page):
        super().__init__(page)
        self.customer_combobox = page.locator("label:has-text('Müşteri')").locator("..").first 

    def select_customer(self, tc_number):
        self.customer_combobox.click()
        self.page.wait_for_timeout(500)
        self.page.keyboard.type(tc_number)
        self.page.wait_for_timeout(1000)
        dropdown_option = self.page.get_by_role("option").filter(has_text=tc_number).first
        dropdown_option.click()

    
    def musteriEhliyet(self):

        self.page.wait_for_timeout(1500)
    
        modal_basligi= self.page.locator("div").filter(has_text=re.compile(r"^Sürücü\*Sürücü$")).first
        
        if modal_basligi.is_visible():
            ehliyet_modal = EhliyetModal(self.page)
            ehliyet_modal.ehliyet_kaydet()
        else:
            print(" Müşteri var")



    def elle_arac_sec(self):
        
        self.page.wait_for_timeout(1000)
        
        arac_label = self.page.locator("label").filter(has_text=re.compile(r"^Araç$"))
        arac_kutusu = arac_label.locator("..").first
        kutu_metni = arac_kutusu.inner_text()
        temiz_metin = kutu_metni.replace("Araç", "").replace("*", "").replace("\n", "").strip()
        
        if temiz_metin != "":
            print("Değişiklik yapılmıyor.")
        else:
            
            arac_kutusu.click()
            self.page.wait_for_timeout(1000)
            
            ilk_arac = self.page.get_by_role("option").first
            ilk_arac.click()
            self.page.wait_for_timeout(500)
            print(" İlk araç seçildi.")


    
        
    def faturaAdresiSec(self):

        self.page.keyboard.press("End")
        self.page.wait_for_timeout(2000)
        
        
        fatura_baslik = self.page.get_by_text("Fatura Adresi Bilgileri").first
        fatura_baslik.scroll_into_view_if_needed()
        self.page.wait_for_timeout(500)

        isim_kutusu = self.page.locator("#section5").get_by_text("İsim").locator("..").first
        ham_metin = isim_kutusu.inner_text()
        temiz_metin = "".join(ham_metin.split())
        
        # Hata ayıklama için siyah ekrana yazdırıyoruz
        print(f"\n--- DEDEKTİF: Ham Okunan: {repr(ham_metin)} ---")
        print(f"--- DEDEKTİF: Temizlenmiş Hali: '{temiz_metin}' ---\n")


        if temiz_metin in ["İsim-", "İsim", "İsim—", "İsim–"]:
            print("⚠️ Kutu kesinlikle BOŞ! Adres ekleme modali açılıyor...")
            
            print("Kalem ikonlu düzenleme butonuna basılıyor...")
            kalem_butonu = fatura_baslik.locator("xpath=./ancestor::div[3]").locator("button").first
            kalem_butonu.click(force=True)
            self.page.wait_for_timeout(1000)
            yeni_adres_buton=self.page.locator("button").filter(has_text="ADRES").first
            yeni_adres_buton.click(force=True)
            self.page.wait_for_timeout(1000)
            yeni_adres2_buton=self.page.locator("button").filter(has_text=re.compile(r"^ADRES EKLE$", re.IGNORECASE)).first
            yeni_adres2_buton.click(force=True)
            self.page.wait_for_timeout(1000)

            print("Adres...")
            adres_modali = AdresModal(self.page)
            adres_modali.formu_doldur_ve_kaydet()


        else:
            print("dolu")

    def is_invoice_address_present(self):
        self.page.wait_for_timeout(500)
        isim_kutusu = self.page.locator("#section5").get_by_text("İsim").locator("..").first
        ham_metin = isim_kutusu.inner_text()
        temiz_metin = "".join(ham_metin.split())
        return temiz_metin not in ["İsim", "İsim-", "İsim—", "İsim–"]

    def selected_customer_tc(self):
        customer_text = self.customer_combobox.inner_text().strip()
        return customer_text

    def is_save_button_visible(self):
        kaydet_butonu = self.page.locator("button").filter(has_text=re.compile(r"^Kaydet$", re.IGNORECASE)).first
        return kaydet_butonu.is_visible()

    def kaydet(self):
        kaydet_butonu = self.page.locator("button").filter(has_text=re.compile(r"^Kaydet$", re.IGNORECASE)).first
        if kaydet_butonu.is_visible():

            self.page.wait_for_timeout(1000)
            kaydet_butonu.click()
        else:
            print("kaydet butonu çıkmadı")


