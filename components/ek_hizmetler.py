import random
import re

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import expect


class EkHizmetler:
    """Rezervasyon formundaki Ek Hizmetler bölümünü yönetir."""

    AY_ADI_DESENI = re.compile(
        r"^(Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|"
        r"Eylül|Ekim|Kasım|Aralık)(\s+\d{4})?$",
        re.IGNORECASE,
    )
    HARIC_TUTULAN_HIZMETLER = {"ek sürücü"}

    def __init__(self, page, rng=None):
        self.page = page
        # Testte sabit seçim enjekte edilebilir; gerçek akışta sistem rastgeleliği kullanılır.
        self.rng = rng or random.SystemRandom()

    @property
    def bolum_basligi(self):
        return self.page.get_by_text("Ek Hizmet ve Teklifler", exact=True).first

    @property
    def bolum(self):
        # Sayfadaki diğer checkbox'ları (ödeme, izin vb.) seçmemek için yalnızca
        # başlığın ait olduğu ve checkbox içeren en yakın kapsayıcıya ineriz.
        return self.bolum_basligi.locator(
            "xpath=ancestor::*[.//*[@role='checkbox'] or .//input[@type='checkbox']][1]"
        )

    @property
    def aylik_ozellestir_sekmesi(self):
        return self.page.get_by_role(
            "tab", name="Aylık Özelleştir", exact=True
        )

    @property
    def toplu_islem_sekmesi(self):
        return self.page.get_by_role("tab", name="Toplu İşlem", exact=True)

    @staticmethod
    def _normalize(metin):
        return " ".join(metin.split()).casefold()

    @staticmethod
    def _hizmet_adi(checkbox):
        return checkbox.evaluate(
            r"""
            element => {
                const label = element.labels && element.labels[0];
                if (label && label.innerText.trim()) return label.innerText.trim();

                const ariaLabel = element.getAttribute('aria-label');
                if (ariaLabel) return ariaLabel.trim();

                const labelledBy = element.getAttribute('aria-labelledby');
                if (labelledBy) {
                    const text = labelledBy.split(/\s+/)
                        .map(id => document.getElementById(id)?.innerText || '')
                        .join(' ').trim();
                    if (text) return text;
                }

                const card = element.closest('label, li, [class*="card"], .v-col');
                return (card?.innerText || '').split('\n')[0].trim();
            }
            """
        )

    def _secilen_hizmet_adaylari(self):
        expect(self.bolum_basligi).to_be_visible(timeout=15000)
        checkboxes = self.bolum.get_by_role("checkbox")

        adaylar = []
        for index in range(checkboxes.count()):
            checkbox = checkboxes.nth(index)
            if checkbox.is_visible() and checkbox.is_enabled() and not checkbox.is_checked():
                ad = self._hizmet_adi(checkbox) or f"Ek hizmet #{index + 1}"
                if self._normalize(ad) in self.HARIC_TUTULAN_HIZMETLER:
                    continue
                adaylar.append((checkbox, ad))

        return adaylar

    def _tek_hizmet_sec(self, tercih_edilen_hizmet=None):
        adaylar = self._secilen_hizmet_adaylari()

        if not adaylar:
            raise AssertionError(
                "Ek Hizmet ve Teklifler bölümünde Ek Sürücü haricinde "
                "seçilebilir ek hizmet bulunamadı."
            )

        if tercih_edilen_hizmet:
            aranan_hizmet = self._normalize(tercih_edilen_hizmet)
            secilen = next(
                (
                    aday
                    for aday in adaylar
                    if self._normalize(aday[1]) == aranan_hizmet
                ),
                None,
            )
            if secilen is None:
                uygun_hizmetler = ", ".join(ad for _, ad in adaylar)
                raise AssertionError(
                    f"'{tercih_edilen_hizmet}' ek hizmeti bulunamadı. "
                    f"Seçilebilir hizmetler: {uygun_hizmetler}"
                )
            checkbox, hizmet_adi = secilen
        else:
            checkbox, hizmet_adi = self.rng.choice(adaylar)

        checkbox.scroll_into_view_if_needed()
        checkbox.check()
        expect(checkbox).to_be_checked()

        print(f"Rastgele seçilen ek hizmet: {hizmet_adi}")
        return hizmet_adi

    def rastgele_sec(self):
        """Görünür dönemde Ek Sürücü dışındaki bir hizmeti rastgele seçer."""
        return self._tek_hizmet_sec()

    def _aylik_ozellestirme_kullanilabilir(self):
        sekme = self.aylik_ozellestir_sekmesi
        return sekme.count() > 0 and sekme.is_visible() and sekme.is_enabled()

    def _gorunen_ay_adlari(self):
        ay_sekmeleri = self.bolum.get_by_role("tab")

        try:
            ay_sekmeleri.first.wait_for(state="visible", timeout=5000)
        except PlaywrightTimeoutError:
            return []

        ay_adlari = []
        for index in range(ay_sekmeleri.count()):
            sekme = ay_sekmeleri.nth(index)
            if not sekme.is_visible():
                continue

            sekme_adi = " ".join(sekme.inner_text().split())
            if self.AY_ADI_DESENI.fullmatch(sekme_adi):
                ay_adlari.append(sekme_adi)

        return ay_adlari

    def _toplu_secime_don(self):
        sekme = self.toplu_islem_sekmesi
        if sekme.count() > 0 and sekme.is_visible() and sekme.is_enabled():
            sekme.click()

    def rezervasyona_gore_sec(self, tercih_edilen_hizmet=None):
        """Rezervasyon periyotlarına göre birer ek hizmet seçer.

        Birden fazla ay sekmesi varsa Aylık Özelleştir akışı kullanılır.
        Tek dönem varsa eski toplu seçim davranışı korunur. Dönemlerin
        hiçbirinde Ek Sürücü seçilmez.
        """
        expect(self.bolum_basligi).to_be_visible(timeout=15000)

        if self._aylik_ozellestirme_kullanilabilir():
            self.aylik_ozellestir_sekmesi.click()
            expect(self.aylik_ozellestir_sekmesi).to_have_attribute(
                "aria-selected", "true"
            )

            ay_adlari = self._gorunen_ay_adlari()
            if len(ay_adlari) > 1:
                secimler = []
                for ay_adi in ay_adlari:
                    ay_sekmesi = self.bolum.get_by_role(
                        "tab", name=ay_adi, exact=True
                    )
                    ay_sekmesi.click()
                    expect(ay_sekmesi).to_have_attribute(
                        "aria-selected", "true"
                    )
                    self.bolum.get_by_role("checkbox").first.wait_for(
                        state="visible", timeout=5000
                    )

                    hizmet_adi = self._tek_hizmet_sec(
                        tercih_edilen_hizmet
                    )
                    secimler.append(
                        {"donem": ay_adi, "hizmet": hizmet_adi}
                    )
                    print(f"{ay_adi} dönemi: {hizmet_adi}")

                return secimler

        self._toplu_secime_don()
        hizmet_adi = self._tek_hizmet_sec(tercih_edilen_hizmet)
        return [{"donem": "Tüm dönem", "hizmet": hizmet_adi}]

    def aylik_rezervasyonda_sec(self):
        """Aylık formdaki düğmelerden Ek Sürücü dışı bir hizmet seçer."""
        expect(
            self.page.get_by_role("heading", name="Ek hizmetler ve özel fiyat")
        ).to_be_visible(timeout=15000)

        self.page.get_by_role("button", name="Tüm rezervasyonlar").click()
        hizmetler = []
        fiyat_deseni = re.compile(r"^(.+?)\s+\d[\d.,]*\s*/\s*\d[\d.,]*\s*₺$")
        butonlar = self.page.get_by_role("button")
        for index in range(butonlar.count()):
            buton = butonlar.nth(index)
            if not buton.is_visible() or not buton.is_enabled():
                continue
            metin = " ".join(buton.inner_text().split())
            eslesme = fiyat_deseni.fullmatch(metin)
            if eslesme and self._normalize(eslesme.group(1)) not in self.HARIC_TUTULAN_HIZMETLER:
                hizmetler.append((buton, eslesme.group(1)))

        if not hizmetler:
            raise AssertionError("Aylık formda seçilebilir ek hizmet bulunamadı.")

        buton, hizmet_adi = self.rng.choice(hizmetler)
        buton.click()
        print(f"Aylık rezervasyon ek hizmeti: {hizmet_adi}")
        return [{"donem": "Tüm rezervasyonlar", "hizmet": hizmet_adi}]
