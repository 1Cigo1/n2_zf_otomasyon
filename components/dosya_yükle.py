import os
import re

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError

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

        try:
            self.kaydet_butonu.wait_for(state="visible", timeout=3000)
            self.kaydet_butonu.click()
        except PlaywrightTimeoutError:
            # Bazı çoklu yükleme ekranları dosyaları otomatik kaydeder.
            pass

    def ayri_alanlara_yukle(
        self,
        container,
        dosya_listesi: list[str],
        input_selector: str = "input[type='file']",
    ):
        """Her fotoğraf alanına listedeki karşılık gelen dosyayı yükler."""
        dosya_inputlari = container.locator(input_selector)
        input_sayisi = dosya_inputlari.count()

        if input_sayisi >= len(dosya_listesi):
            for index, dosya_adi in enumerate(dosya_listesi):
                dosya_yolu = os.path.join(os.getcwd(), "test_data", dosya_adi)
                if not os.path.isfile(dosya_yolu):
                    raise AssertionError(f"Yüklenecek dosya bulunamadı: {dosya_yolu}")
                dosya_inputlari.nth(index).set_input_files(dosya_yolu)
            self._yuklemelerin_bitmesini_bekle(container)
            return

        upload_buttons = container.locator(
            "button, .v-btn, [role='button'], .upload-button, .mdi-paperclip"
        )
        upload_buttons = upload_buttons.filter(
            has_text=re.compile(r"(Yükle|Upload|Resim|Fotoğraf|Ekle|Dosya)", re.I)
        )

        if upload_buttons.count() < len(dosya_listesi):
            raise AssertionError(
                f"{len(dosya_listesi)} fotoğraf alanı bekleniyordu, "
                f"{input_sayisi} file input bulundu."
            )

        for index, dosya_adi in enumerate(dosya_listesi):
            dosya_yolu = os.path.join(os.getcwd(), "test_data", dosya_adi)
            if not os.path.isfile(dosya_yolu):
                raise AssertionError(f"Yüklenecek dosya bulunamadı: {dosya_yolu}")

            with self.page.expect_file_chooser() as fc_info:
                upload_buttons.nth(index).click(force=True)
            fc_info.value.set_files(dosya_yolu)
        self._yuklemelerin_bitmesini_bekle(container)

    def coklu_alana_yukle(
        self,
        container,
        buton_adi: str,
        dosya_listesi: list[str],
        input_selector: str = "input[type='file']",
    ):
        """Tek dosya seçicisinden birden fazla fotoğrafı aynı alana yükler."""
        tam_yollar = [
            os.path.join(os.getcwd(), "test_data", dosya_adi)
            for dosya_adi in dosya_listesi
        ]
        for dosya_yolu in tam_yollar:
            if not os.path.isfile(dosya_yolu):
                raise AssertionError(f"Yüklenecek dosya bulunamadı: {dosya_yolu}")

        dosya_inputu = container.locator(input_selector).first
        try:
            dosya_inputu.wait_for(state="attached", timeout=5_000)
        except PlaywrightTimeoutError as error:
            raise AssertionError(f"{buton_adi} dosya alanı bulunamadı.") from error
        if dosya_inputu.get_attribute("multiple") is None:
            raise AssertionError(f"{buton_adi} alanı çoklu dosya kabul etmiyor.")

        dosya_inputu.set_input_files(tam_yollar)
        self._yuklemelerin_bitmesini_bekle(container)

    def _yuklemelerin_bitmesini_bekle(self, container):
        """Tüm dosyalardan sonra yükleme göstergesini yalnızca bir kez bekler."""
        loading = container.locator(
            "button.v-btn--loading, button[aria-busy='true']"
        ).first
        try:
            loading.wait_for(state="visible", timeout=500)
        except PlaywrightTimeoutError:
            # Küçük dosyalar 500 ms içinde tamamlanmış olabilir.
            return

        try:
            loading.wait_for(state="hidden", timeout=15_000)
        except PlaywrightTimeoutError as error:
            raise AssertionError(
                "Fotoğrafların yüklenmesi 15 saniyede tamamlanmadı."
            ) from error
