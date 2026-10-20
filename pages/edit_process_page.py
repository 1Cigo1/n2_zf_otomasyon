import re
import random
from playwright.sync_api import expect
from pages.base_page import BasePage
from components.adres_modal import AdresModal
from components.ehliyet_modal import EhliyetModal
from components.tarih_sec import TarihSec
from components.dosya_yükle import GenelDosyaYukleyici
from components.ek_hizmetler import EkHizmetler

class EditProcessPage(BasePage):
    def __init__(self, page):
        super().__init__(page)

        self.customer_combobox = page.locator("label:has-text('Müşteri')").locator("..").first
        self.modal_basligi = page.locator("div").filter(has_text=re.compile(r"^Sürücü\*Sürücü$")).first
        self.fatura_baslik = page.get_by_text("Fatura Adresi Bilgileri").first
        self.isim_kutusu = page.locator("#section5").get_by_text("İsim").locator("..").first
        self.kaydet_butonu = page.locator("button").filter(has_text=re.compile(r"^Kaydet$", re.IGNORECASE)).first
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
        ehliyet_tarihi = self.page.get_by_placeholder(
            "Ehliyet Veriliş Tarihi", exact=True
        )
        ehliyet_formu_acik = (
            self.modal_basligi.is_visible()
            or (ehliyet_tarihi.count() > 0 and ehliyet_tarihi.is_visible())
        )
        if ehliyet_formu_acik:
            ehliyet_modal = EhliyetModal(self.page)
            ehliyet_modal.ehliyet_kaydet()
        else:
            print("Ehliyet var")

    def faturaAdresiSec(self, monthly=False):

        if monthly:
            baslik = self.page.get_by_role(
                "heading", name="Fatura Adresi Bilgileri", exact=True
            )
            bolum = baslik.locator(
                "xpath=ancestor::*[.//button and .//*[normalize-space(text())='Fatura Tipi']][1]"
            )
            expect(bolum).to_be_visible(timeout=10000)
            isim = bolum.get_by_text("İsim", exact=True).first.locator(
                "xpath=following-sibling::*[1]"
            ).inner_text().strip()
            if isim not in {"", "-", "—", "–"}:
                print("Aylık müşterinin fatura adresi dolu")
                return

            bolum.get_by_role("button").first.click()
            self.yeni_adres_buton.click()
            self.yeni_adres2_buton.click()
            AdresModal(self.page).formu_doldur_ve_kaydet()
            return

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

    def kisa_tarih_sec(self,reservation_type, ay_sayisi=2):

        tarih_getir=TarihSec(self.page)
        tarih_getir.tarih_ve_saat(reservation_type, ay_sayisi=ay_sayisi)

    def odemeyiSonraAl(self):

        self.page.get_by_role("checkbox", name="Ödemeyi Sonra Al").check()
        self.page.wait_for_timeout(2000)
        self.page.get_by_role("button", name="Evet").click()

    def rastgele_ek_hizmet_sec(self):
        """Her görünür rezervasyon dönemi için bir ek hizmet seçer."""
        return EkHizmetler(self.page).rezervasyona_gore_sec()

    def aylik_alan_sec(self, alan_adi, aranan):
        """Aylık formdaki aramalı listeden görünen seçeneği tıklar."""
        alan = self.page.get_by_role(
            "textbox", name=re.compile(rf"^{re.escape(alan_adi)}(?:\s|$)")
        )
        alan.fill(aranan)
        secenek = self.page.get_by_role("option").filter(has_text=aranan).first
        expect(secenek).to_be_visible(timeout=10000)
        secenek.click()
        print(f"{alan_adi} seçildi: {aranan}")

    def aylik_rastgele_arac_sec(self):
        """SKODA ve SUPERB seçildikten sonra listeden bir araç alır."""
        arac_alani = self.page.get_by_role(
            "textbox", name=re.compile(r"^Araç(?:\s|$)")
        )
        arac_alani.click()
        secenekler = self.page.get_by_role("option")
        expect(secenekler.first).to_be_visible(timeout=10000)
        araclar = []
        for index in range(secenekler.count()):
            secenek = secenekler.nth(index)
            if secenek.is_visible() and secenek.is_enabled() and re.search(
                r"\d{2}[A-ZÇĞİÖŞÜ]{1,3}\d{2,4}", secenek.inner_text()
            ):
                araclar.append(secenek)
        if not araclar:
            raise AssertionError("SKODA SUPERB için seçilebilir araç bulunamadı.")
        secilen = random.SystemRandom().choice(araclar)
        plaka = secilen.inner_text().strip().split(" - ", 1)[0]
        secilen.click()
        print(f"Aylık rezervasyon aracı: {plaka}")
        return plaka

    def aylik_islemleri_tamamla(self, tc_number, ay_sayisi=2):
        if not tc_number:
            raise RuntimeError(
                "Aylık müşteri eksik: TEST_ENV ortamına uygun "
                "*_MONTHLY_CUSTOMER_IDENTITY_NO değerini .env veya "
                "GitLab Variables içine ekleyin."
            )

        self.kisa_tarih_sec("Monthly", ay_sayisi=ay_sayisi)
        ofis = "Ankara Çankaya (Next Level AVM)"
        self.aylik_alan_sec("Teslim Alma Ofisi", ofis)
        self.aylik_alan_sec("Teslim Etme Ofisi", ofis)
        self.aylik_alan_sec("Marka", "SKODA")
        self.aylik_alan_sec("Model", "SUPERB")
        self.aylik_rastgele_arac_sec()

        self.aylik_alan_sec("Müşteri", tc_number)
        self.musteriEhliyet()


        secilen_ek_hizmet = EkHizmetler(self.page).aylik_rezervasyonda_sec()
        self.faturaAdresiSec(monthly=True)
        olustur = self.page.get_by_role("button", name="Rezervasyonları oluştur")
        expect(olustur).to_be_enabled(timeout=10000)
        olustur.click()
        return secilen_ek_hizmet

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

        if reservation_type.lower() == "monthly":
            return self.aylik_islemleri_tamamla(tc_number)

        secilen_ek_hizmet = None

        self.kisa_tarih_sec(reservation_type)
        self.select_customer(tc_number)
        self.musteriEhliyet()
        self.page.wait_for_timeout(1000)
        self.teslim_ofis.click()
        self.teslim_ofis.press_sequentially("Ankara Çankaya (Next Level AVM)")
        self.page.wait_for_timeout(1000)
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

            # Tek dönemse bir hizmet, birden fazla ay varsa her ay için ayrı
            # bir hizmet seçilir. Ek Sürücü aday listesine hiçbir zaman girmez.
            secilen_ek_hizmet = self.rastgele_ek_hizmet_sec()
        else:
            self.odemeyiSonraAl()

        self.faturaAdresiSec()
        self.kaydet()
        self.page.wait_for_timeout(1000)
        self.sözlesme_olustur(reservation_type)
        return secilen_ek_hizmet
