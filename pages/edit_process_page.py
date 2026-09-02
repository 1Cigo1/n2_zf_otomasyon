import re
import os
import random
from pages.base_page import BasePage
from components.adres_modal import AdresModal
from components.ehliyet_modal import EhliyetModal
from components.mona_modal import MonoModal
from components.tarih_sec import TarihSec
from components.dosya_yükle import GenelDosyaYukleyici
from datetime import datetime, timedelta

class EditProcessPage(BasePage):
    def __init__(self, page):
        super().__init__(page)
        
        self.customer_combobox = page.locator("label:has-text('Müşteri')").locator("..").first 
        self.modal_basligi = page.locator("div").filter(has_text=re.compile(r"^Sürücü\*Sürücü$")).first
        self.arac_label = page.locator("label").filter(has_text=re.compile(r"^Araç$"))
        self.arac_kutusu = self.arac_label.locator("..").first
        self.fatura_baslik = page.get_by_text("Fatura Adresi Bilgileri").first
        self.isim_kutusu = page.locator("#section5").get_by_text("İsim").locator("..").first
        self.kaydet_butonu = page.locator("button").filter(has_text=re.compile(r"^Kaydet$", re.IGNORECASE)).first
        self.tarih_baslangic = page.get_by_role("combobox", name="Rezervasyon Bitiş Tarihi")
        self.tarih_kutusu = page.get_by_role("combobox", name="Rezervasyon Bitiş Tarihi")
        self.teslim_ofis = page.get_by_role("textbox", name="Teslim Alma Ofisi Teslim Alma")
        self.cankaya_secenegi = page.get_by_role("option").first
        self.arac_grubu = page.get_by_role("textbox", name="Araç Grubu Araç Grubu")
        self.arac_grubu_option = page.get_by_text("CDAD")
        self.fatura_tipi = page.locator("div").filter(has_text=re.compile(r"^Fatura TipiFatura Tipi$")).first
        self.fatura_tipi_option = page.get_by_role("option", name="Full credit")
        self.sözlesme_btn=page.get_by_role("button", name="Sözleşme oluştur")
        self.sözlesme_yukle=page.get_by_role("button",name="Sözleşme Yükle")
        self.provizyon_al=page.get_by_role("button", name="Provizyon Al")
        self.provizyon_tutar=page.get_by_role("spinbutton", name="Provizyon Tutarı Provizyon")
        self.kalem_butonu = self.fatura_baslik.locator("xpath=./ancestor::div[3]").locator("button").first
        self.yeni_adres_buton = page.locator("button").filter(has_text="ADRES").first
        self.yeni_adres2_buton = page.locator("button").filter(has_text=re.compile(r"^ADRES EKLE$", re.IGNORECASE)).first
        
    def select_customer(self, tc_number):

        self.customer_combobox.click()
        self.page.wait_for_timeout(500)
        self.page.keyboard.type(tc_number)
        self.page.wait_for_timeout(1000)
        dropdown_option = self.page.get_by_role("option").filter(has_text=tc_number).first
        dropdown_option.click()
        
    def musteriEhliyet(self):

        self.page.wait_for_timeout(1500)
    
        if self.modal_basligi.is_visible():
            ehliyet_modal = EhliyetModal(self.page)
            ehliyet_modal.ehliyet_kaydet()
        else:
            print("Ehliyet var")

    def faturaAdresiSec(self):

        self.page.keyboard.press("End")
        self.page.wait_for_timeout(2000)
        self.fatura_baslik.scroll_into_view_if_needed()
        self.page.wait_for_timeout(500)
        ham_metin = self.isim_kutusu.inner_text()
        temiz_metin = "".join(ham_metin.split())
        
        if temiz_metin in ["İsim-", "İsim", "İsim—", "İsim–"]:

            self.kalem_butonu.click(force=True)
            self.page.wait_for_timeout(1000)
            self.yeni_adres_buton.click(force=True)
            self.page.wait_for_timeout(1000)
            self.yeni_adres2_buton.click(force=True)
            self.page.wait_for_timeout(1000)

            adres_modali = AdresModal(self.page)
            adres_modali.formu_doldur_ve_kaydet()

        else:
            print("dolu")

    def kaydet(self):

        if self.kaydet_butonu.is_visible():
            self.page.wait_for_timeout(1000)
            self.kaydet_butonu.click()
        else:
            print("kaydet butonu çıkmadı")

    def kisa_tarih_sec(self,reservation_type):

        tarih_getir=TarihSec(self.page)
        tarih_getir.tarih_ve_saat(reservation_type)

    def odemeyiSonraAl(self):

        self.page.get_by_role("checkbox", name="Ödemeyi Sonra Al").check()
        self.page.wait_for_timeout(2000)
        self.page.get_by_role("button", name="Evet").click()

    def sözlesme_olustur(self, reservation_type: str):

        self.sözlesme_btn.click()
        self.sözlesme_yukle.click()
        yukle=GenelDosyaYukleyici(self.page)
        yukle.tekli_dosya_yukle("Ekran Resmi 2026-08-17 16.53.56.png")
    
        if reservation_type.lower() != "Corporate".lower():    
            self.provizyon_al.click()
            self.provizyon_tutar.click()
            self.provizyon_tutar.fill("0")
            self.page.locator(".v-btn.v-theme--light.text-green").click()
            self.page.get_by_role("button", name="Evet").click()

        self.page.get_by_role("button", name="Teslimata Yönlendir").click()
      
    def islemleri_tamamla(self, tc_number, reservation_type: str):

        self.kisa_tarih_sec(reservation_type) 
        self.select_customer(tc_number)
        self.musteriEhliyet()
        self.page.wait_for_timeout(1000)
        self.teslim_ofis.click()
        self.teslim_ofis.press_sequentially("yht", delay=100)
        self.page.wait_for_timeout(500)
        self.cankaya_secenegi.click()
        self.arac_grubu.click()
        self.page.wait_for_timeout(3000)
        self.arac_grubu_option.click()
        self.page.wait_for_timeout(3000)
        if reservation_type.lower() == "Corporate".lower():
        
            if self.fatura_tipi.is_visible():
                self.fatura_tipi.click()
                self.fatura_tipi_option.click()
                self.page.wait_for_timeout(1000)
            else:
                print("Fatura tipi seçeneği görünmüyor.")
        else:
            self.odemeyiSonraAl()

        self.faturaAdresiSec()
        self.kaydet()
        self.page.wait_for_timeout(1000)
        self.sözlesme_olustur(reservation_type)
        




  


