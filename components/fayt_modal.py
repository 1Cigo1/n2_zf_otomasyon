import random
import re
from dataclasses import dataclass, field
from time import monotonic

from playwright.sync_api import (
    ElementHandle,
    Error as PlaywrightError,
    Locator,
    Page,
    TimeoutError as PlaywrightTimeoutError,
    expect,
)

from components.dosya_yükle import GenelDosyaYukleyici


@dataclass
class WorkflowContext:
    """Bir talep ilerlerken modallar arasında korunacak değerler."""

    workflow_key: str
    selected_vehicle: str | None = None
    selected_plate: str | None = None
    initial_km: int | None = None
    current_vehicle_km: int | None = None
    final_km: int | None = None
    values: dict[str, str] = field(default_factory=dict)
    attempted_vehicles: set[str] = field(default_factory=set)
    request_closed: bool = False


class FaytModal:
    """Her modalı kendi seçicisi ve fonksiyonuyla yönetir."""

    INITIAL_REQUEST_KM = 1_000_000

    MAINTENANCE_PHOTOS = (
        "egea_arka.jpeg",
        "egea_iç.jpg",
        "egea_ön.jpg",
        "egea_ön1.jpeg",
        "egea_sağ.jpg",
        "egea_sol.jpg",
    )

    WASHING_PHOTOS = (
        "egea_ön.jpg",
        "egea_ön1.jpeg",
        "egea_sağ.jpg",
        "egea_sol.jpg",
        "egea_arka.jpeg",
        "egea_iç.jpg",
    )
    VEHICLE_OPTION_PATTERN = re.compile(
        r"^\d{2}[A-ZÇĞİÖŞÜ]{1,3}\d{2,4}\s+-"
    )
    FUEL_VEHICLE_OPTION_PATTERN = re.compile(
        r"^\d{2}[A-ZÇĞİÖŞÜ]{1,3}\d{2,4}\s+-.*\(\d+\s*/"
    )
    ACTIVE_WORKFLOW_REQUEST_MESSAGE = (
        "Bu araç için aynı iş akışında aktif bir talep bulunmaktadır"
    )

    def __init__(self, page: Page):
        self.page = page
        self.uploader = GenelDosyaYukleyici(page)
        # Aynı toast ekranda birkaç kez okunsa bile rapora yalnız bir kez yazılır.
        self.reported_messages: set[str] = set()

    @property
    def dialog(self) -> Locator:
        return self.page.locator(".v-dialog[role='dialog']:visible").last

    def wait_until_open(self, timeout: int = 10_000) -> None:
        self.dialog.wait_for(state="visible", timeout=timeout)

    def is_open(self) -> bool:
        return self.dialog.count() > 0

    def field(self, label: str) -> Locator:
        by_label = self.dialog.get_by_label(label, exact=True)
        if by_label.count() > 0:
            return by_label

        # Bazı Vuetify alanlarında label-input bağlantısı yoktur; görünen alan
        # adı yalnız placeholder olarak bulunur (ör. Yakıt Miktarı).
        by_placeholder = self.dialog.get_by_placeholder(label, exact=True)
        if by_placeholder.count() > 0:
            return by_placeholder

        return self.dialog.locator(".v-input").filter(
            has_text=label
        ).locator("input").first

    def has_field(self, label: str) -> bool:
        locator = self.field(label)
        return locator.count() > 0 and locator.is_visible()

    def button(self, name: str) -> Locator:
        candidates = self.dialog.get_by_role(
            "button", name=re.compile(rf"^{re.escape(name)}$", re.I)
        )
        if name.casefold() != "kapat":
            return candidates

        # Sağ üstteki X ikonunun aria-label değeri de "Kapat". Gerçek workflow
        # KAPAT düğmesinde bu aria-label bulunmadığı için yalnız bu isimde ayır.
        for index in range(candidates.count()):
            candidate = candidates.nth(index)
            aria_label = (candidate.get_attribute("aria-label") or "").casefold()
            if aria_label != "kapat":
                return candidate

        return self.dialog.locator("button[data-fys-action-not-found]")

    def has_button(self, name: str) -> bool:
        locator = self.button(name)
        return locator.count() > 0 and locator.is_visible()

    def is_vehicle_request_close_modal(self) -> bool:
        """Dinamik KM/yakıt alanları açılan gerçek talep kapatma modalını tanır."""
        title = self.dialog.get_by_text("Araç Talebini Kapat", exact=True)
        return (
            self.has_button("Kapat")
            and title.count() > 0
            and title.is_visible()
        )

    def choose_random_option(
        self,
        locator: Locator,
        field_name: str,
        excluded: set[str] | None = None,
        required_pattern: re.Pattern[str] | None = None,
        preferred_pattern: re.Pattern[str] | None = None,
    ) -> str:
        """Textbox'a fill yapmak yerine açılan listeden rastgele seçer."""
        locator.locator("xpath=..").click()
        locator.press("ArrowDown")

        options = self.page.locator(
            ".v-overlay--active [role='listbox'] [role='option']:visible"
        )
        options.first.wait_for(state="visible", timeout=5_000)
        count = options.count()
        if count == 0:
            raise AssertionError(f"{field_name} için seçenek bulunamadı.")

        excluded = excluded or set()
        candidate_indexes = [
            index
            for index in range(count)
            if options.nth(index).inner_text().strip() not in excluded
            and (
                required_pattern is None
                or required_pattern.search(options.nth(index).inner_text().strip())
            )
        ]
        if not candidate_indexes:
            raise AssertionError(
                f"{field_name} için daha önce denenmemiş seçenek kalmadı."
            )

        preferred_indexes = [
            index
            for index in candidate_indexes
            if preferred_pattern is not None
            and preferred_pattern.search(options.nth(index).inner_text().strip())
        ]
        if preferred_indexes:
            candidate_indexes = preferred_indexes

        selected = options.nth(random.choice(candidate_indexes))
        value = selected.inner_text().strip()
        selected.click()
        print(f"{field_name} seçildi: {value}")
        return value

    def fill_description(self) -> None:
        editor = self.dialog.locator(".ql-editor")
        if editor.count() > 0 and editor.is_visible():
            editor.fill("Otomasyon testi")

    def displayed_vehicle_km(self) -> int:
        heading = self.dialog.get_by_role("heading", name="Kilometre", exact=True)
        if heading.count() == 0 or not heading.is_visible():
            raise AssertionError("Modalda aracın mevcut kilometresi bulunamadı.")

        value = heading.locator("xpath=following-sibling::*[1]").inner_text()
        digits = re.sub(r"\D", "", value)
        if not digits:
            raise AssertionError(f"Araç kilometresi sayısal değil: {value}")
        return int(digits)

    # Her modal kendi fonksiyonunda doldurulur.

    def arac_bakim_talep_modali(self, context: WorkflowContext) -> bool:
        if not self.has_field("Araç"):
            return False

        if context.selected_vehicle is None:
            context.selected_vehicle = self.choose_random_option(
                self.field("Araç"), "Araç"
            )
            context.selected_plate = context.selected_vehicle.split(" - ", 1)[0]
            return True

        if self.has_field("Araç KM") and context.initial_km is None:
            context.initial_km = self.INITIAL_REQUEST_KM
            self.field("Araç KM").fill(str(context.initial_km))
            return True

        if self.has_field("Bakım Periyodu") and "maintenance_period" not in context.values:
            context.values["maintenance_period"] = self.choose_random_option(
                self.field("Bakım Periyodu"), "Bakım Periyodu"
            )
            return True

        if self.has_field("Bakım Türü") and "maintenance_type" not in context.values:
            context.values["maintenance_type"] = self.choose_random_option(
                self.field("Bakım Türü"), "Bakım Türü"
            )
            return True

        if "maintenance_photos" not in context.values:
            self.uploader.coklu_yukle(list(self.MAINTENANCE_PHOTOS))
            context.values["maintenance_photos"] = "true"
            return True

        self.fill_description()
        return False

    def yikama_talep_modali(self, context: WorkflowContext) -> bool:
        return self.fotografli_arac_talep_modali(
            context,
            completed_key="washing_request_photos",
            workflow_name="Standart Yıkama",
        )

    def yakit_alma_talep_modali(self, context: WorkflowContext) -> bool:
        # Fotoğraf bileşeni seçim sırasında formu yeniden çizebiliyor. Bu yüzden
        # yakıt seviyesi fotoğraflardan sonra doldurulup gerçek input değeriyle
        # doğrulanır.
        if (
            context.selected_vehicle is not None
            and "fuel_request_photos" in context.values
            and self.has_field("Yakıt Seviyesi (1-8)")
        ):
            fuel_level = self.field("Yakıt Seviyesi (1-8)")
            if fuel_level.input_value().strip() == "4":
                context.values["fuel_level"] = "4"
                return False

            fuel_level.fill("4")
            fuel_level.press("Tab")
            expect(fuel_level).to_have_value("4", timeout=5_000)
            context.values["fuel_level"] = "4"
            return True

        return self.fotografli_arac_talep_modali(
            context,
            completed_key="fuel_request_photos",
            workflow_name="Kiralama Dönüşü Yakıt Alma",
            upload_button_name="Araç Fotoğrafları",
            vehicle_pattern=self.FUEL_VEHICLE_OPTION_PATTERN,
        )

    def fotografli_arac_talep_modali(
        self,
        context: WorkflowContext,
        completed_key: str,
        workflow_name: str,
        upload_button_name: str | None = None,
        vehicle_pattern: re.Pattern[str] | None = None,
        preferred_vehicle_pattern: re.Pattern[str] | None = None,
    ) -> bool:
        """Fotoğraf alanı açılan bir araç seçer ve aynı araca fotoğraf yükler."""
        if not self.has_field("Araç"):
            return False

        if context.selected_vehicle is None:
            file_inputs = self.dialog.locator("input[type='file']")

            max_attempts = 15
            remaining_attempts = max_attempts - len(context.attempted_vehicles)
            for _ in range(max(remaining_attempts, 0)):
                old_file_input = (
                    file_inputs.first
                    if file_inputs.count() > 0
                    else None
                )
                selected_vehicle = self.choose_random_option(
                    self.field("Araç"),
                    "Araç",
                    context.attempted_vehicles,
                    vehicle_pattern or self.VEHICLE_OPTION_PATTERN,
                    preferred_vehicle_pattern,
                )
                context.attempted_vehicles.add(selected_vehicle)

                if old_file_input is not None:
                    old_file_handle = old_file_input.element_handle()
                    try:
                        self.page.wait_for_function(
                            """input => !input.isConnected ||
                                !input.files || input.files.length === 0""",
                            arg=old_file_handle,
                            timeout=5_000,
                        )
                    except PlaywrightTimeoutError:
                        # Bazı araç geçişlerinde aynı input düğümü yeniden
                        # kullanılır. Yeni yükleme mevcut FileList'i zaten
                        # değiştireceği için seçim kontrolüne devam edilir.
                        pass
                    finally:
                        old_file_handle.dispose()
                try:
                    if upload_button_name:
                        file_inputs.first.wait_for(
                            state="attached", timeout=3_000
                        )
                    else:
                        file_inputs.nth(len(self.WASHING_PHOTOS) - 1).wait_for(
                            state="attached", timeout=5_000
                        )
                except PlaywrightTimeoutError:
                    print(
                        f"Fotoğraf alanı açılmadı, başka araç deneniyor: "
                        f"{selected_vehicle}"
                    )
                    continue

                context.selected_vehicle = selected_vehicle
                context.selected_plate = selected_vehicle.split(" - ", 1)[0]
                return True

            raise AssertionError(
                f"Denenen {max_attempts} araç için de {workflow_name} "
                "fotoğraf alanları açılmadı."
            )

        if completed_key not in context.values:
            if upload_button_name:
                self.uploader.coklu_alana_yukle(
                    self.dialog,
                    upload_button_name,
                    list(self.WASHING_PHOTOS),
                )
                context.values[completed_key] = "true"
                print(f"{workflow_name} ilk modalına 6 araç fotoğrafı yüklendi.")
                return True

            file_inputs = self.dialog.locator("input[type='file']")
            # Araç seçildikten sonra fotoğraf alanları API cevabıyla sonradan
            # oluşturuluyor. Sabit bekleme yerine altıncı input DOM'a gelene
            # kadar bekle; hızlı/yavaş CI koşularında aynı şekilde çalışır.
            try:
                file_inputs.nth(len(self.WASHING_PHOTOS) - 1).wait_for(
                    state="attached", timeout=10_000
                )
            except PlaywrightTimeoutError as error:
                raise AssertionError(
                    f"Araç seçildi fakat {workflow_name} fotoğraf alanları "
                    "10 saniye içinde açılmadı."
                ) from error

            if file_inputs.count() < len(self.WASHING_PHOTOS):
                raise AssertionError(
                    f"{workflow_name} ilk modalında altı araç fotoğrafı "
                    f"alanı bekleniyordu, {file_inputs.count()} alan bulundu."
                )

            self.uploader.ayri_alanlara_yukle(
                self.dialog, list(self.WASHING_PHOTOS)
            )
            context.values[completed_key] = "true"
            print(f"{workflow_name} ilk modalına 6 araç fotoğrafı yüklendi.")
            return True

        self.fill_description()
        return False

    @classmethod
    def is_active_workflow_request_message(cls, message: str) -> bool:
        """Aynı araç/workflow için açık talep uyarısını talep kodundan bağımsız tanır."""
        return cls.ACTIVE_WORKFLOW_REQUEST_MESSAGE.casefold() in message.casefold()

    def prepare_another_request_vehicle(
        self, context: WorkflowContext, failure: BaseException
    ) -> bool:
        """Aktif talebi olan aracı bırakıp yıkama/yakıt için yeni seçime hazırlanır."""
        if not (self.has_field("Araç") and self.has_button("Kaydet")):
            return False

        validation_message = self.validation_messages()
        failure_message = str(failure)
        combined_message = " | ".join(
            text for text in (failure_message, validation_message) if text
        )
        has_active_request = self.is_active_workflow_request_message(
            combined_message
        )

        # Yakıt akışındaki eski davranışı koru: herhangi bir validation mesajı
        # olmadan ilk modal kapanmazsa fotoğraf alanı açmayan/bozuk araç yerine
        # başka araç denenebilir. Yıkamada ise yalnız kesin aktif-talep mesajı
        # geldiğinde araç değiştirilir.
        is_unexplained_fuel_save_failure = (
            context.workflow_key == "kiralama_donusu_yakit_alma"
            and "Kaydet tıklandı fakat modal" in failure_message
            and not validation_message
        )
        if not has_active_request and not is_unexplained_fuel_save_failure:
            return False

        failed_vehicle = context.selected_vehicle or "bilinmeyen araç"
        file_inputs = self.dialog.locator("input[type='file']")
        for index in range(file_inputs.count()):
            file_inputs.nth(index).set_input_files([])

        context.selected_vehicle = None
        context.selected_plate = None
        context.values.pop("fuel_level", None)
        context.values.pop("fuel_request_photos", None)
        context.values.pop("washing_request_photos", None)
        reason = (
            "aynı iş akışında aktif talebi var"
            if has_active_request
            else "talep kaydedilemedi"
        )
        print(
            f"Seçilen aracın {reason}; başka araç deneniyor: {failed_vehicle}"
        )
        return True

    def prepare_another_fuel_vehicle(
        self, context: WorkflowContext, failure: BaseException
    ) -> bool:
        """Eski çağrıları bozmadan ortak araç değiştirme davranışını kullanır."""
        return self.prepare_another_request_vehicle(context, failure)

    def servis_noktasi_modali(self, context: WorkflowContext) -> bool:
        if not self.has_field("Servis Noktası"):
            return False
        current_value = self.field("Servis Noktası").input_value().strip()
        if current_value:
            context.values["service"] = current_value
            return False
        context.values["service"] = self.choose_random_option(
            self.field("Servis Noktası"), "Servis Noktası"
        )
        return True

    def randevu_tarihi_modali(self, context: WorkflowContext) -> bool:
        if not self.has_field("Randevu Tarihi"):
            return False

        field = self.field("Randevu Tarihi")
        current_value = field.input_value().strip()
        if current_value:
            context.values["appointment"] = current_value
            return False
        field.locator("xpath=..").click()
        field.press("ArrowDown")
        days = self.page.locator(".p-datepicker-day[aria-disabled='false']:visible")
        days.first.wait_for(state="visible", timeout=5_000)
        selected = days.nth(random.randrange(days.count()))
        context.values["appointment"] = selected.inner_text().strip()
        selected.click()
        return True

    def personel_atama_modali(self, context: WorkflowContext) -> bool:
        if not self.has_field("Personel Ataması"):
            return False
        current_value = self.field("Personel Ataması").input_value().strip()
        if current_value:
            context.values["personnel"] = current_value
            return False
        context.values["personnel"] = self.choose_random_option(
            self.field("Personel Ataması"), "Personel"
        )
        return True

    def teslim_yapacak_kisi_modali(self, context: WorkflowContext) -> bool:
        if not self.has_field("Teslim Yapacak Kişi"):
            return False
        current_value = self.field("Teslim Yapacak Kişi").input_value().strip()
        if current_value:
            context.values["delivery_person"] = current_value
            return False
        context.values["delivery_person"] = self.choose_random_option(
            self.field("Teslim Yapacak Kişi"), "Teslim Yapacak Kişi"
        )
        return True

    def mono_modali(self, context: WorkflowContext) -> bool:
        if not self.has_field("Mono"):
            return False
        current_value = self.field("Mono").input_value().strip()
        if current_value:
            context.values["mono"] = current_value
            return False
        context.values["mono"] = self.choose_random_option(
            self.field("Mono"), "Mono"
        )
        return True

    def arac_bakim_km_modali(self, context: WorkflowContext) -> bool:
        if not (
            self.has_field("Aracın KM")
            and self.has_field("Yakıt Miktarı Yakıt Miktarı ")
            and not self.has_button("Kapat")
        ):
            return False
        if "maintenance_final_km" in context.values:
            return False

        current_km = self.displayed_vehicle_km()
        context.current_vehicle_km = current_km
        context.final_km = max(current_km, context.initial_km or 0) + random.randint(
            10, 100
        )
        self.field("Aracın KM").fill(str(context.final_km))
        self.field("Yakıt Miktarı Yakıt Miktarı ").fill("4")
        context.values["maintenance_final_km"] = "true"
        return True

    def yikama_kapatma_modali(self, context: WorkflowContext) -> bool:
        return self.yikama_arac_durumu_modali(context, "Kapat", "washing_close_filled")

    def yikama_ilerlet_modali(self, context: WorkflowContext) -> bool:
        return self.yikama_arac_durumu_modali(
            context, "İlerlet", "washing_advance_filled"
        )

    def yikama_arac_durumu_modali(
        self, context: WorkflowContext, action: str, completed_key: str
    ) -> bool:
        """Yıkamanın ilerlet ve kapat modallarındaki ortak KM/yakıt/fotoğraf formu."""
        if not self.has_button(action):
            return False

        condition_fields = self.wait_for_fuel_condition_fields()
        if condition_fields is None:
            return False
        km_field, fuel_field = condition_fields

        current_km = self.displayed_vehicle_km()
        context.current_vehicle_km = current_km

        # Kapat modalı araç ve ortama göre üç yapıda gelebiliyor: 6 ayrı zorunlu
        # alan, 6 dosyayı birlikte alan tek bir `multiple` input veya yalnız araç
        # görseline ait yardımcı bir file input. Alan sayısına tek başına bakmak
        # bu yüzden yeterli değildir.
        separate_photo_selector = "input[type='file'][required]:not([multiple])"
        multiple_photo_selector = "input[type='file'][multiple]"
        photo_fields = self.dialog.locator(separate_photo_selector)
        multiple_photo_field = self.dialog.locator(multiple_photo_selector).first
        has_separate_photo_fields = photo_fields.count() > 0
        has_multiple_photo_field = multiple_photo_field.count() > 0
        # Butonun İlerlet/Kapat olması fotoğraf zorunluluğunu belirlemiyor.
        # Bazı araçlarda İlerlet adımı da tamamen fotoğrafsız açılıyor.
        requires_photos = has_separate_photo_fields or has_multiple_photo_field
        if requires_photos:
            if has_multiple_photo_field:
                photos_are_ready = self._multiple_file_input_is_filled(
                    multiple_photo_field, len(self.WASHING_PHOTOS)
                )
                if not photos_are_ready:
                    self.uploader.coklu_alana_yukle(
                        self.dialog,
                        "Araç Fotoğrafları",
                        list(self.WASHING_PHOTOS),
                        input_selector=multiple_photo_selector,
                    )
            else:
                try:
                    photo_fields.nth(len(self.WASHING_PHOTOS) - 1).wait_for(
                        state="attached", timeout=10_000
                    )
                except PlaywrightTimeoutError as error:
                    raise AssertionError(
                        "Yıkama araç durumu modalında 6 zorunlu fotoğraf alanı açılmadı."
                    ) from error
                photos_are_ready = self._file_inputs_are_filled(
                    photo_fields, len(self.WASHING_PHOTOS)
                )
                if not photos_are_ready:
                    self.uploader.ayri_alanlara_yukle(
                        self.dialog,
                        list(self.WASHING_PHOTOS),
                        input_selector=separate_photo_selector,
                    )
        else:
            photos_are_ready = True

        # Fotoğraf veya KM değişikliği Vuetify formunu yeniden çizebilir.
        # Eski locatorlara güvenmeden görünür alanları tekrar çözümle.
        condition_fields = self.wait_for_fuel_condition_fields()
        if condition_fields is None:
            return False
        km_field, fuel_field = condition_fields

        entered_km = self._numeric_input_value(km_field)
        fuel_value = fuel_field.input_value().strip()
        if (
            entered_km is not None
            and entered_km >= current_km
            and fuel_value == "4"
            and photos_are_ready
        ):
            context.final_km = entered_km
            context.values[completed_key] = "true"
            return False

        # Bazı araçlarda alan mevcut KM ile hazır geliyor ve daha büyük bir
        # değer yazıldığında arayüz tekrar mevcut KM'ye dönüyor. İş kuralı
        # "büyük veya eşit" olduğu için geçerli hazır değeri değiştirme.
        if entered_km is not None and entered_km >= current_km:
            context.final_km = entered_km
        else:
            context.final_km = max(
                current_km, context.final_km or 0
            ) + random.randint(10, 100)
            km_field.fill(str(context.final_km))
            km_field.press("Tab")

        condition_fields = self.wait_for_fuel_condition_fields(timeout=5_000)
        if condition_fields is None:
            return False
        _, fuel_field = condition_fields
        # Bazı Vuetify sayı alanları fill() ile oluşan tek input eventini geri
        # alıyor. Gerçek klavye olayları üreterek sayısal değerin modele
        # yazılmasını sağla.
        fuel_field.click()
        fuel_field.fill("")
        fuel_field.press_sequentially("4", delay=100)
        fuel_field.press("Tab")

        condition_fields = self.wait_for_fuel_condition_fields(timeout=5_000)
        if condition_fields is None:
            return False
        km_field, fuel_field = condition_fields
        entered_km = self._numeric_input_value(km_field)
        if entered_km is None or entered_km < current_km:
            raise AssertionError(
                "Yıkama araç durumu KM değeri aracın mevcut kilometresinden düşük. "
                f"Mevcut={current_km}, girilen={entered_km}"
            )
        context.final_km = entered_km
        expect(fuel_field).to_have_value("4", timeout=5_000)
        if requires_photos:
            if has_multiple_photo_field:
                photos_are_ready = self._multiple_file_input_is_filled(
                    self.dialog.locator(multiple_photo_selector).first,
                    len(self.WASHING_PHOTOS),
                )
            else:
                photos_are_ready = self._file_inputs_are_filled(
                    self.dialog.locator(separate_photo_selector),
                    len(self.WASHING_PHOTOS),
                )
            if not photos_are_ready:
                raise AssertionError(
                    "Yıkama araç durumu fotoğrafları doldurma sırasında kayboldu."
                )

        self.fill_description()
        context.values[completed_key] = "true"
        print(
            f"Yıkama araç durumu dolduruldu: KM={context.final_km}, "
            "yakıt=4, "
            f"fotoğraf={'6' if requires_photos else 'yok'}"
        )
        return True

    def yakit_alma_arac_durumu_modali(self, context: WorkflowContext) -> bool:
        """Yakıt alma adımındaki görünür KM/yakıt alanlarını sıra bağımsız doldurur."""
        if self.has_button("Kapat"):
            completed_key = "fuel_close_filled"
        elif self.has_button("İlerlet"):
            completed_key = "fuel_advance_filled"
        else:
            # Onay ekranında geçmiş talep özeti içinde aynı alan adları
            # bulunabilir; yalnız veri giriş aksiyonu olan modalları doldur.
            return False

        condition_fields = self.wait_for_fuel_condition_fields()
        if condition_fields is None:
            return False
        km_field, fuel_field = condition_fields

        current_km = self.displayed_vehicle_km()
        context.current_vehicle_km = current_km

        # İlerlet modallarında alanlar label/placeholder sahibi olsa da altı
        # fotoğraf zorunludur. Kapat modalında bu alanlar bulunmaz. Ayrımı alan
        # adına göre değil, modalın gerçek aksiyonuna göre yapıyoruz.
        requires_photos = self.has_button("İlerlet")
        photo_fields = self.dialog.locator("input[type='file']")
        if requires_photos:
            try:
                photo_fields.nth(len(self.WASHING_PHOTOS) - 1).wait_for(
                    state="attached", timeout=10_000
                )
            except PlaywrightTimeoutError as error:
                raise AssertionError(
                    "Yakıt araç durumu modalında 6 zorunlu fotoğraf alanı açılmadı."
                ) from error
            photos_are_ready = self._file_inputs_are_filled(
                photo_fields, len(self.WASHING_PHOTOS)
            )
            if not photos_are_ready:
                self.uploader.ayri_alanlara_yukle(
                    self.dialog, list(self.WASHING_PHOTOS)
                )
        else:
            photos_are_ready = True

        # Fotoğraf seçimi Vuetify formunu yeniden çizebildiği için eski input
        # locatorlarına ve eski değerlere güvenme; sayısal alanları yeniden bul.
        condition_fields = self.wait_for_fuel_condition_fields()
        if condition_fields is None:
            return False
        km_field, fuel_field = condition_fields

        # Aynı isimli form workflow içinde birden fazla kez açılabiliyor. Önceki
        # modalda kullanılan context anahtarına güvenmek yeni modalın boş fotoğraf
        # alanlarını atlatıyordu. Bu nedenle her açılışta görünür formun kendi
        # değerlerini kontrol ediyoruz.
        entered_km = self._numeric_input_value(km_field)
        fuel_value = fuel_field.input_value().strip()
        if (
            entered_km is not None
            and entered_km > current_km
            and fuel_value == "4"
            and photos_are_ready
        ):
            context.values[completed_key] = "true"
            return False

        context.final_km = max(current_km, context.final_km or 0) + random.randint(
            10, 100
        )
        km_field.fill(str(context.final_km))
        km_field.press("Tab")

        # KM blur olduğunda da form yenilenebildiği için yakıt alanını bir kez
        # daha çözümleyip en son dolduruyoruz.
        condition_fields = self.wait_for_fuel_condition_fields(timeout=5_000)
        if condition_fields is None:
            return False
        _, fuel_field = condition_fields
        fuel_field.fill("4")
        fuel_field.press("Tab")

        condition_fields = self.wait_for_fuel_condition_fields(timeout=5_000)
        if condition_fields is None:
            return False
        km_field, fuel_field = condition_fields
        expect(km_field).to_have_value(str(context.final_km), timeout=5_000)
        expect(fuel_field).to_have_value("4", timeout=5_000)
        if requires_photos and not self._file_inputs_are_filled(
            self.dialog.locator("input[type='file']"), len(self.WASHING_PHOTOS)
        ):
            raise AssertionError(
                "Yakıt araç durumu fotoğrafları doldurma sırasında kayboldu."
            )

        self.fill_description()
        context.values[completed_key] = "true"
        print(
            f"Yakıt araç durumu dolduruldu: KM={context.final_km}, yakıt=4, "
            f"fotoğraf={'6' if requires_photos else 'yok'}"
        )
        return True

    @staticmethod
    def _numeric_input_value(locator: Locator) -> int | None:
        """Bir input değerindeki ayraçları yok sayarak kilometreyi okur."""
        digits = re.sub(r"\D", "", locator.input_value())
        return int(digits) if digits else None

    @staticmethod
    def _file_inputs_are_filled(file_inputs: Locator, required_count: int) -> bool:
        """Yeni açılan modalın zorunlu fotoğraflarının gerçekten seçildiğini söyler."""
        if file_inputs.count() < required_count:
            return False
        return all(
            file_inputs.nth(index).evaluate(
                "input => Boolean(input.files && input.files.length)"
            )
            for index in range(required_count)
        )

    @staticmethod
    def _multiple_file_input_is_filled(
        file_input: Locator, required_count: int
    ) -> bool:
        """Tek bir multiple input içindeki zorunlu dosya sayısını doğrular."""
        return file_input.count() > 0 and file_input.evaluate(
            "(input, count) => Boolean(input.files && input.files.length >= count)",
            required_count,
        )

    def resolve_fuel_condition_fields(self) -> tuple[Locator, Locator] | None:
        """Görünür KM/yakıt inputlarını önce semantik adlarıyla bulur."""
        if self.has_field("Aracın KM"):
            km_field = self.field("Aracın KM")
            for fuel_name in (
                "Yakıt Miktarı",
                "Yakıt Miktarı Yakıt Miktarı ",
            ):
                if self.has_field(fuel_name):
                    return km_field, self.field(fuel_name)

        # Eski modal sürümünde iki sayı alanının label bağlantısı bulunmuyor.
        # Önce yalnız type=number alanları, en son da tam olarak iki görünür ve
        # düzenlenebilir Vuetify inputu kabul edilir. Üçüncü bir alan varsa yanlış
        # inputa yazmak yerine modalın hazır olmasını bekleriz.
        selector_base = (
            "input.v-field__input:visible:not([disabled]):not([readonly])"
            ":not([type='file']):not([type='hidden'])"
        )
        numeric_fields = self.dialog.locator(f"{selector_base}[type='number']")
        if numeric_fields.count() == 2:
            return numeric_fields.nth(0), numeric_fields.nth(1)

        editable_fields = self.dialog.locator(selector_base)
        if editable_fields.count() == 2:
            return editable_fields.nth(0), editable_fields.nth(1)
        return None

    def wait_for_fuel_condition_fields(
        self, timeout: int = 10_000
    ) -> tuple[Locator, Locator] | None:
        """Dinamik açılan KM ve yakıt alanlarının birlikte hazır olmasını bekler."""
        deadline = monotonic() + timeout / 1000
        while True:
            # Ara yükleme görünümü onay ekranına dönüştüyse bu modal bir
            # KM/yakıt giriş adımı değildir; aksiyon motoruna geri dön.
            if self.has_button("Onayla"):
                return None

            fields = self.resolve_fuel_condition_fields()
            if fields is not None:
                return fields

            remaining = deadline - monotonic()
            if remaining <= 0:
                content = " ".join(self.dialog.inner_text().split())
                raise AssertionError(
                    "Yakıt araç durumu modalında KM ve yakıt alanları "
                    f"{timeout / 1000:g} saniyede birlikte açılmadı. "
                    f"Modal: {content[:500]}"
                )
            self.page.wait_for_timeout(min(100, remaining * 1000))

    def has_yakit_arac_durumu_alani(self) -> bool:
        """Dinamik açılan labelsız yakıt formunun başladığını tanır."""
        has_action = self.has_button("İlerlet") or self.has_button("Kapat")
        km_heading = self.dialog.get_by_role(
            "heading", name="Kilometre", exact=True
        )
        has_km_heading = km_heading.count() > 0 and km_heading.is_visible()
        return has_action and (
            self.resolve_fuel_condition_fields() is not None or has_km_heading
        )

    def wait_for_dynamic_fuel_step(self, timeout: int = 10_000) -> bool:
        """Geçici Onayla görünümünün gerçek yakıt formuna dönüşmesini bekler."""
        try:
            self.page.wait_for_function(
                """() => {
                    const dialogs = Array.from(document.querySelectorAll(
                        ".v-dialog[role='dialog'].v-overlay--active"
                    )).filter(element => {
                        const style = window.getComputedStyle(element);
                        return element.isConnected && element.getClientRects().length > 0 &&
                            style.display !== "none" && style.visibility !== "hidden";
                    });
                    const dialog = dialogs.at(-1);
                    if (!dialog) return true;

                    const actions = Array.from(dialog.querySelectorAll("button"))
                        .map(button => button.textContent.trim().toLocaleUpperCase("tr-TR"));
                    return dialog.querySelectorAll("input[type='file']").length >= 6 ||
                        actions.includes("İLERLET") || actions.includes("KAPAT");
                }""",
                timeout=timeout,
            )
            return True
        except PlaywrightTimeoutError:
            # Değişmeyen Onayla, gerçek bir onay adımıdır.
            return False

    # Düğme fonksiyonları da ayrıdır.

    @staticmethod
    def _element_is_visible(element: ElementHandle) -> bool:
        """Modal geçişinde DOM'dan kopan elementleri güvenli biçimde kontrol eder."""
        try:
            return element.is_visible()
        except PlaywrightError:
            return False

    def click_action(self, name: str) -> None:
        # Python'da "İlerlet".lower() birleşik noktalı i üretir. Buton adını
        # karşılaştırmadan önce Türkçe büyük İ karakterini normalleştiriyoruz.
        normalized_name = name.replace("İ", "I").lower()
        if not self.is_open():
            return

        original_dialog = self.dialog.element_handle()
        old_text = original_dialog.inner_text()
        ready_timeout = (
            60_000 if normalized_name in {"ilerlet", "onayla"} else 15_000
        )
        ready_deadline = monotonic() + ready_timeout / 1000
        try:
            while True:
                # Backend işlemi sürerken modal kendiliğinden kapanmış veya yeni
                # modal ile değiştirilmişse eski aksiyona ikinci kez tıklama.
                if not self._element_is_visible(original_dialog):
                    return

                action_button = self.button(name).locator(
                    "xpath=self::*[not(@aria-busy='true') "
                    "and not(contains(@class, 'v-btn--loading')) "
                    "and not(@disabled) and not(@aria-disabled='true')]"
                )
                if action_button.count() > 0 and action_button.is_visible():
                    break

                remaining = ready_deadline - monotonic()
                if remaining <= 0:
                    raise AssertionError(
                        f"'{name}' butonu {ready_timeout / 1000:g} saniye boyunca "
                        "yükleme durumundan çıkmadı. "
                        f"Mesaj: {self.validation_messages() or 'mesaj bulunamadı'}"
                    )
                self.page.wait_for_timeout(min(100, remaining * 1000))

            try:
                action_button.click(force=normalized_name == "onayla")
            except PlaywrightError:
                if not self._element_is_visible(original_dialog):
                    return
                raise

            if normalized_name in {"kaydet", "kapat"}:
                self.wait_until_saved(original_dialog, action_name=name)
                return

            # Butonun loading'e geçmesi modal ilerledi anlamına gelmez. Aynı
            # modal gerçekten kapanana veya loading bittikten sonra içeriği
            # değişene kadar bekleyerek aynı Onayla'ya ikinci kez basmayı önle.
            change_timeout = (
                60_000 if normalized_name in {"ilerlet", "onayla"} else 15_000
            )
            change_deadline = monotonic() + change_timeout / 1000
            while True:
                if not self._element_is_visible(original_dialog):
                    return

                messages = self.validation_messages()
                if messages and self.has_button(name):
                    raise AssertionError(
                        f"'{name}' tıklandı fakat modal değişmedi. Mesaj: {messages}"
                    )

                is_loading = original_dialog.evaluate(
                    """dialog => Boolean(dialog.querySelector(
                        "button.v-btn--loading, button[aria-busy='true']"
                    ))"""
                )
                current_text = original_dialog.inner_text()
                if not is_loading and current_text != old_text:
                    return

                remaining = change_deadline - monotonic()
                if remaining <= 0:
                    raise AssertionError(
                        f"'{name}' tıklandı fakat modal değişmedi. "
                        f"Mesaj: {messages or 'mesaj bulunamadı'}"
                    )
                self.page.wait_for_timeout(min(100, remaining * 1000))
        finally:
            original_dialog.dispose()

    def wait_until_saved(
        self, saving_dialog: ElementHandle, timeout: int = 30_000,
        action_name: str = "Kaydet",
    ) -> None:
        """Kaydet/Kapat sonrası bildirimde durmadan modalın kapanmasını bekler."""
        deadline = monotonic() + timeout / 1000
        observed_messages: list[str] = []
        while True:
            messages = self.validation_messages()
            if not saving_dialog.is_visible():
                # Başarı bildirimi modal kapandıktan hemen sonra oluşabiliyor.
                self.page.wait_for_timeout(300)
                self.validation_messages()
                return

            if messages and messages not in observed_messages:
                observed_messages.append(messages)
            if self.is_active_workflow_request_message(messages):
                raise AssertionError(
                    f"{action_name} sırasında seçilen araç için aktif talep bulundu. "
                    f"Mesaj: {messages}"
                )

            remaining = deadline - monotonic()
            if remaining <= 0:
                break
            # Bu aralık toplam bekleme değildir; modal kapanır kapanmaz dönülür.
            self.page.wait_for_timeout(min(100, remaining * 1000))

        if not saving_dialog.is_visible():
            return
        raise AssertionError(
            f"{action_name} tıklandı fakat modal {timeout / 1000:g} saniyede kapanmadı. "
            "Plaka aramasına geçilmedi; seçilen araç korundu. "
            f"Beklerken görülen mesajlar: {' | '.join(observed_messages) or 'mesaj bulunamadı'}"
        )

    def kaydet(self) -> None:
        self.click_action("Kaydet")

    def ilerlet(self) -> None:
        self.click_action("İlerlet")

    def onayla(self) -> None:
        self.click_action("Onayla")

    def kapat(self) -> None:
        self.click_action("Kapat")

    def validation_messages(self) -> str:
        messages = self.page.locator(
            ".v-messages__message:visible, .p-toast-message-text:visible, "
            ".v-snackbar__content:visible, [role='alert']:not(.v-alert):visible, "
            ".v-alert.text-error:visible, .v-alert.bg-error:visible"
        ).all_inner_texts()
        visible_messages = [text.strip() for text in messages if text.strip()]

        for message in visible_messages:
            if message not in self.reported_messages:
                print(f"[SİSTEM MESAJI] {message}", flush=True)
                self.reported_messages.add(message)

        return " | ".join(visible_messages)
