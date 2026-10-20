from dataclasses import dataclass
from urllib.parse import urlencode

from playwright.sync_api import Locator, Page, TimeoutError as PlaywrightTimeoutError

from components.fayt_modal import FaytModal, WorkflowContext
from pages.base_page import BasePage
from utils.config_reader import Config


@dataclass(frozen=True)
class FaytWorkflow:
    """Bir FAYT sayfasını tanımlayan, ortamdan bağımsız bağlantı bilgisi."""

    key: str

    @property
    def path(self) -> str:
        return f"/demand/list/{self.key}"


class FaytPage(BasePage):
    """FAYT iş akışlarını URL, talep kaydı ve satır aksiyonları üzerinden yönetir."""

    ARAC_BAKIM = FaytWorkflow("arac_bakim")
    STANDART_YIKAMA = FaytWorkflow("standart_yikama")
    KIRALAMA_DONUSU_YAKIT_ALMA = FaytWorkflow("kiralama_donusu_yakit_alma")
    WASHING_WORKFLOWS = {"standart_yikama", "kiralama_donusu_yikama"}
    FUEL_WORKFLOWS = {KIRALAMA_DONUSU_YAKIT_ALMA.key}
    VEHICLE_SELECTION_WORKFLOWS = WASHING_WORKFLOWS | FUEL_WORKFLOWS

    def __init__(self, page: Page):
        super().__init__(page)
        self.new_button = page.get_by_role("button", name="Yeni")

    def open_workflow(self, workflow_key: str) -> FaytWorkflow:
        """Menü metnine bağlı kalmadan workflow listesini açar."""
        workflow = FaytWorkflow(workflow_key.strip())
        if not workflow.key:
            raise ValueError("workflow_key boş bırakılamaz.")

        query = urlencode(
            {
                "workflow_key": workflow.key,
                "page": 1,
                "rowsPerPage": 30,
            }
        )
        self.page.goto(
            f"{Config.BASE_URL.rstrip('/')}{workflow.path}?{query}",
            wait_until="domcontentloaded",
        )
        self.new_button.wait_for(state="visible")
        return workflow

    def start_request(self) -> FaytModal:
        """Açık workflow listesinde yeni talep modalını açar."""
        modal = FaytModal(self.page)
        for attempt in range(2):
            self.new_button.click()
            try:
                modal.wait_until_open(timeout=15_000)
                return modal
            except PlaywrightTimeoutError:
                if attempt == 0:
                    print("Yeni tıklandı fakat modal açılmadı; bir kez yeniden deneniyor.")

        raise AssertionError("Yeni talep modalı iki denemede de açılamadı.")

    def request_row(self, plate: str) -> Locator:
        """Sadece otomasyonun seçtiği araca ait satırı döndürür."""
        return self.page.locator("tbody tr").filter(has_text=plate).first

    def search_plate(self, plate: str) -> None:
        """Plakayı yazıp tablonun kendi arama düğmesine tıklar."""
        search = self.page.get_by_role(
            "textbox", name="Herhangi bir şey arayın"
        ).first
        search.wait_for(state="visible", timeout=10_000)
        search.fill(plate)

        search_area = search.locator(
            "xpath=ancestor::div[.//button[.//*[contains(@class, 'ti-search')]]][1]"
        )
        search_button = search_area.locator("button:has(.ti-search)").first
        search_button.wait_for(state="visible", timeout=10_000)
        search_button.click()
        print(f"{plate} plakası arama düğmesiyle arandı.")

    def filter_request_by_plate(self, plate: str) -> Locator:
        """Listeyi seçilen plakaya göre filtreleyip kayıt satırını bekler."""
        self.search_plate(plate)

        row = self.request_row(plate)
        try:
            row.wait_for(state="visible", timeout=30_000)
        except PlaywrightTimeoutError:
            # Bazı koşularda arama isteği tabloyu geç yeniliyor. Sayfayı bir
            # kez tazeleyip aynı filtreyi uygulamak eski satıra tıklamayı da
            # engeller.
            self.page.reload(wait_until="domcontentloaded")
            self.search_plate(plate)
            row = self.request_row(plate)
            row.wait_for(state="visible", timeout=30_000)
        return row

    def advance_selected_request(self, plate: str) -> bool:
        """Seçilen talebin satırındaki ilerlet/tamamla aksiyonunu açar."""
        row = self.filter_request_by_plate(plate)

        # Butonun erişilebilir adı yok ve rengi değişebilir. Plaka satırının
        # en son işlem hücresindeki semantik ilerlet/tamamla ikonunu kullan.
        action_cell = row.locator("td").last
        advance_button = action_cell.locator(
            "button:has(i.mdi-progress-check), button:has(i.mdi-check-all)"
        ).first
        if advance_button.count() == 0:
            return False

        advance_button.wait_for(state="visible", timeout=10_000)
        if not advance_button.is_enabled():
            return False

        print(f"{plate} satırındaki Talep İlerlet aksiyonu bulundu.")
        advance_button.click()
        try:
            FaytModal(self.page).wait_until_open(timeout=30_000)
        except PlaywrightTimeoutError as error:
            raise AssertionError(
                f"{plate} için Talep İlerlet aksiyonuna tıklandı "
                "fakat modal açılmadı."
            ) from error
        print(f"{plate} için Talep İlerlet modalı açıldı.")
        return True

    def process_open_modal(
        self, modal: FaytModal, context: WorkflowContext
    ) -> WorkflowContext:
        """Açık modalı benzersiz alanıyla bulur ve ilgili fonksiyonu çağırır."""
        for _ in range(40):
            if not modal.is_open():
                return context

            field_was_filled = False

            # Ortak modallar: her biri kendi seçicisiyle çağrılır.
            # Aynı modalda birden fazla alan bulunabilir. Üstteki alan daha önce
            # doldurulmuşsa aşağıdaki handler'lara düşmeye devam et; eski if/elif
            # yapısı KM ve yakıt alanlarını bazen atlıyordu.
            if (
                modal.has_field("Servis Noktası")
                and modal.servis_noktasi_modali(context)
            ):
                field_was_filled = True
            elif (
                modal.has_field("Randevu Tarihi")
                and modal.randevu_tarihi_modali(context)
            ):
                field_was_filled = True
            elif (
                modal.has_field("Teslim Yapacak Kişi")
                and modal.teslim_yapacak_kisi_modali(context)
            ):
                field_was_filled = True
            elif (
                modal.has_field("Personel Ataması")
                and modal.personel_atama_modali(context)
            ):
                field_was_filled = True
            elif modal.has_field("Mono") and modal.mono_modali(context):
                field_was_filled = True
            elif (
                context.workflow_key in self.WASHING_WORKFLOWS
                and modal.is_vehicle_request_close_modal()
                and modal.yikama_kapatma_modali(context)
            ):
                field_was_filled = True
            elif (
                context.workflow_key in self.WASHING_WORKFLOWS
                and modal.has_field("Aracın KM")
                and modal.has_button("İlerlet")
                and modal.yikama_ilerlet_modali(context)
            ):
                field_was_filled = True
            elif (
                context.workflow_key in self.FUEL_WORKFLOWS
                and not modal.has_button("Onayla")
                and (
                    modal.has_button("İlerlet")
                    or modal.has_button("Kapat")
                )
                and (
                    modal.has_field("Aracın KM")
                    or modal.has_yakit_arac_durumu_alani()
                )
                and modal.yakit_alma_arac_durumu_modali(context)
            ):
                field_was_filled = True
            elif (
                context.workflow_key == self.ARAC_BAKIM.key
                and modal.has_field("Aracın KM")
                and modal.arac_bakim_km_modali(context)
            ):
                field_was_filled = True
            # İlk talep modalı araç seçiminden sonra yeniden kontrol edilir.
            # Fotoğraf ve diğer bağımlı alanlar araç seçilince sonradan açılır.
            elif modal.has_field("Araç") and modal.has_button("Kaydet"):
                if context.workflow_key == self.ARAC_BAKIM.key:
                    field_was_filled = modal.arac_bakim_talep_modali(context)
                elif context.workflow_key in self.WASHING_WORKFLOWS:
                    field_was_filled = modal.yikama_talep_modali(context)
                elif context.workflow_key in self.FUEL_WORKFLOWS:
                    field_was_filled = modal.yakit_alma_talep_modali(context)

            if field_was_filled:
                self.page.wait_for_timeout(400)
                continue

            modal.fill_description()

            # Alanlar tamamlandıktan sonra modalın kendi düğmesi çağrılır.
            if modal.has_button("Onayla"):
                if (
                    context.workflow_key in self.FUEL_WORKFLOWS
                    and modal.wait_for_dynamic_fuel_step()
                ):
                    continue
                # Bekleme sırasında geçici modal kapanmış olabilir. Eski Onayla
                # locatorını tekrar kullanmak yerine döngünün güncel UI'ı okumasını sağla.
                if not modal.is_open() or not modal.has_button("Onayla"):
                    continue
                modal.onayla()
            elif modal.has_button("Kaydet"):
                try:
                    modal.kaydet()
                except AssertionError as error:
                    if (
                        context.workflow_key in self.VEHICLE_SELECTION_WORKFLOWS
                        and modal.prepare_another_request_vehicle(context, error)
                    ):
                        continue
                    raise
            elif modal.has_button("Kapat"):
                modal.kapat()
                context.request_closed = True
                return context
            elif modal.has_button("İlerlet"):
                modal.ilerlet()
            else:
                content = " ".join(modal.dialog.inner_text().split())
                raise AssertionError(
                    f"{context.workflow_key} için tanınmayan modal: {content[:800]}"
                )

        raise AssertionError(
            f"{context.workflow_key} açık modalı 40 işlemde tamamlanamadı."
        )

    def run_workflow(self, workflow_key: str) -> WorkflowContext:
        """Talebi oluşturur ve seçilen aynı araç kaydını sonuna kadar ilerletir."""
        workflow = self.open_workflow(workflow_key)
        context = WorkflowContext(workflow_key=workflow.key)

        modal = self.start_request()
        self.process_open_modal(modal, context)

        for _ in range(10):
            if context.request_closed:
                return context
            if not context.selected_plate:
                raise AssertionError("Araç seçilmeden talep ilerletilemez.")

            if not self.advance_selected_request(context.selected_plate):
                return context

            self.process_open_modal(modal, context)
            if context.request_closed:
                return context

        raise AssertionError("Talep akışı beklenen en fazla adım sayısını aştı.")

    def run_vehicle_maintenance(
        self, workflow_key: str = ARAC_BAKIM.key
    ) -> WorkflowContext:
        """Araç bakım talebini ortak workflow motoruyla çalıştırır."""
        return self.run_workflow(workflow_key)

    def run_standard_washing(self) -> WorkflowContext:
        """Yeni Standart Yıkama talebi oluşturup seçilen aracı ilerletir."""
        return self.run_workflow(self.STANDART_YIKAMA.key)

    def run_rental_return_fuel(self) -> WorkflowContext:
        """Kiralama dönüşü yakıt alma talebini ortak workflow motoruyla çalıştırır."""
        return self.run_workflow(self.KIRALAMA_DONUSU_YAKIT_ALMA.key)

    # Eski test adını korur; çağıran testleri değiştirmek zorunda bırakmaz.
    def ssh_arac_bakim(self) -> WorkflowContext:
        return self.run_vehicle_maintenance()

    def standart_yikama(self) -> WorkflowContext:
        return self.run_standard_washing()

    def kiralama_donusu_yakit_alma(self) -> WorkflowContext:
        return self.run_rental_return_fuel()
