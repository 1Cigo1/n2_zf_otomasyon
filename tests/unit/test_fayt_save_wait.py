import pytest
from playwright.sync_api import sync_playwright

from components.fayt_modal import FaytModal, WorkflowContext
from pages.fayt_pages import FaytPage


@pytest.fixture(scope="module")
def local_browser():
    # Chromium'u her testte yeniden başlatmak CI'da süreç birikmesine ve
    # BrowserType.launch timeout'una yol açabiliyor.
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        yield browser
        browser.close()


@pytest.fixture
def local_page(local_browser):
    # Her test temiz bir Page alır; yalnız ağır Chromium süreci ortak kullanılır.
    page = local_browser.new_page()
    try:
        yield page
    finally:
        page.close()


def test_fuel_vehicle_pattern_requires_existing_numeric_fuel_level():
    assert FaytModal.FUEL_VEHICLE_OPTION_PATTERN.search(
        "06TST201 - HYUNDAI İ20 (2 / Benzin)"
    )
    assert not FaytModal.FUEL_VEHICLE_OPTION_PATTERN.search(
        "67LSA678 - TOFAS-FIAT PRATICO (None / Dizel)"
    )


@pytest.mark.parametrize(
    ("method_name", "expected_pattern"),
    [
        ("yikama_talep_modali", None),
        ("yakit_alma_talep_modali", FaytModal.FUEL_VEHICLE_OPTION_PATTERN),
    ],
)
def test_vehicle_request_modals_do_not_prefer_a_fixed_plate(
    local_page,
    monkeypatch,
    method_name,
    expected_pattern,
):
    modal = FaytModal(local_page)
    captured = {}

    def capture_call(_context, **kwargs):
        captured.update(kwargs)
        return False

    monkeypatch.setattr(modal, "fotografli_arac_talep_modali", capture_call)
    getattr(modal, method_name)(WorkflowContext(workflow_key="test"))

    assert captured.get("preferred_vehicle_pattern") is None
    assert captured.get("vehicle_pattern") is expected_pattern


def test_failed_initial_fuel_vehicle_is_cleared_for_another_selection(local_page):
    local_page.set_content('''
        <div class="v-dialog v-overlay--active" role="dialog">
            <label for="vehicle">Araç</label>
            <input id="vehicle" value="67LSA334 - CHERY KİMO (2 / Elektrikli)">
            <input id="photos" type="file" multiple>
            <button>Kaydet</button>
        </div>
    ''')
    local_page.locator('#photos').set_input_files([
        {"name": "photo.jpg", "mimeType": "image/jpeg", "buffer": b"photo"}
    ])
    context = WorkflowContext(
        workflow_key="kiralama_donusu_yakit_alma",
        selected_vehicle="67LSA334 - CHERY KİMO (2 / Elektrikli)",
        selected_plate="67LSA334",
        values={"fuel_level": "4", "fuel_request_photos": "true"},
    )

    changed = FaytModal(local_page).prepare_another_fuel_vehicle(
        context,
        AssertionError(
            "Kaydet tıklandı fakat modal 30 saniyede kapanmadı. "
            "Beklerken görülen mesajlar: mesaj bulunamadı"
        ),
    )

    assert changed
    assert context.selected_vehicle is None
    assert context.selected_plate is None
    assert "fuel_level" not in context.values
    assert "fuel_request_photos" not in context.values
    assert local_page.locator('#photos').evaluate("input => input.files.length") == 0


@pytest.mark.parametrize(
    ("workflow_key", "completed_values"),
    [
        ("standart_yikama", {"washing_request_photos": "true"}),
        (
            "kiralama_donusu_yakit_alma",
            {"fuel_level": "4", "fuel_request_photos": "true"},
        ),
    ],
)
def test_active_request_vehicle_is_cleared_for_washing_and_fuel(
    local_page, workflow_key, completed_values
):
    local_page.set_content('''
        <div class="v-dialog v-overlay--active" role="dialog">
            <label for="vehicle">Araç</label>
            <input id="vehicle" value="06TST202 - FIAT EGEA (4 / Dizel)">
            <input id="photos" type="file" multiple>
            <button>Kaydet</button>
        </div>
        <div role="alert">
            Bu araç için aynı iş akışında aktif bir talep bulunmaktadır.
            Talep Kodu: #2029. Önce mevcut talebi tamamlayın veya iptal edin.
        </div>
    ''')
    local_page.locator('#photos').set_input_files([
        {"name": "photo.jpg", "mimeType": "image/jpeg", "buffer": b"photo"}
    ])
    context = WorkflowContext(
        workflow_key=workflow_key,
        selected_vehicle="06TST202 - FIAT EGEA (4 / Dizel)",
        selected_plate="06TST202",
        values=completed_values.copy(),
        attempted_vehicles={"06TST202 - FIAT EGEA (4 / Dizel)"},
    )

    changed = FaytModal(local_page).prepare_another_request_vehicle(
        context,
        AssertionError(
            "Kaydet sırasında seçilen araç için aktif talep bulundu."
        ),
    )

    assert changed
    assert context.selected_vehicle is None
    assert context.selected_plate is None
    assert "washing_request_photos" not in context.values
    assert "fuel_level" not in context.values
    assert "fuel_request_photos" not in context.values
    assert local_page.locator('#photos').evaluate("input => input.files.length") == 0
    assert "06TST202 - FIAT EGEA (4 / Dizel)" in context.attempted_vehicles


def test_active_request_message_stops_save_wait_immediately(local_page):
    local_page.set_content('''
        <div class="v-dialog v-overlay--active" role="dialog">
            <label for="vehicle">Araç</label><input id="vehicle">
            <button>Kaydet</button>
        </div>
        <div role="alert">
            Bu araç için aynı iş akışında aktif bir talep bulunmaktadır.
            Talep Kodu: #2029. Önce mevcut talebi tamamlayın veya iptal edin.
        </div>
    ''')
    modal = FaytModal(local_page)
    saving_dialog = modal.dialog.element_handle()

    try:
        with pytest.raises(AssertionError, match="aktif talep bulundu"):
            modal.wait_until_saved(saving_dialog, timeout=5_000)
    finally:
        saving_dialog.dispose()


def test_system_message_is_printed_only_once(local_page, capsys):
    local_page.set_content('''
        <div role="alert">Kayıt başarıyla oluşturuldu.</div>
    ''')
    modal = FaytModal(local_page)

    modal.validation_messages()
    modal.validation_messages()

    output = capsys.readouterr().out
    assert output.count("[SİSTEM MESAJI] Kayıt başarıyla oluşturuldu.") == 1


def test_save_waits_past_notification_and_loading_text(local_page):
    local_page.set_content("""
        <div class="v-dialog v-overlay--active" role="dialog" id="modal">
            <p id="status">Talep oluştur</p>
            <button onclick="save()">Kaydet</button>
        </div>
        <div role="alert" id="notice"></div>
        <script>
            window.saveCount = 0;
            function save() {
                window.saveCount++;
                document.querySelector('#notice').textContent =
                    'Plakaya Ait Sözleşme Bulunamamıştır';
                document.querySelector('#status').textContent = 'Kaydediliyor';
                setTimeout(() => document.querySelector('#notice').textContent = '', 150);
                setTimeout(() => document.querySelector('#modal').remove(), 600);
            }
        </script>
    """)
    context = WorkflowContext(workflow_key="standart_yikama", selected_plate="06TEST1")

    FaytPage(local_page).process_open_modal(FaytModal(local_page), context)

    assert local_page.locator('#modal').count() == 0
    assert local_page.evaluate('window.saveCount') == 1
    assert context.selected_plate == "06TEST1"


@pytest.mark.parametrize("message", ["Plakaya Ait Sözleşme Bulunamamıştır", ""])
def test_save_timeout_keeps_transient_error_and_does_not_claim_success(local_page, message):
    local_page.set_content("""
        <div class="v-dialog v-overlay--active" role="dialog">Kaydet</div>
        <div role="alert" id="notice"></div>
    """)
    local_page.locator('#notice').evaluate('(node, text) => node.textContent = text', message)
    modal = FaytModal(local_page)
    saving_dialog = modal.dialog.element_handle()
    local_page.evaluate("setTimeout(() => document.querySelector('#notice').remove(), 150)")

    try:
        with pytest.raises(AssertionError) as error:
            modal.wait_until_saved(saving_dialog, timeout=500)
        assert "Plaka aramasına geçilmedi" in str(error.value)
        assert (message or "mesaj bulunamadı") in str(error.value)
        assert modal.is_open()
    finally:
        saving_dialog.dispose()


def test_washing_advance_fills_photos_and_ignores_branch_info(local_page):
    photo_inputs = ''.join(f'<input type="file" id="photo{i}" required>' for i in range(6))
    local_page.set_content('''
        <div class="v-dialog v-overlay--active" role="dialog" id="modal">
            <div role="alert" class="v-alert text-info">Genel Merkez</div>
            <h2>Kilometre</h2><span>21400</span>
            <label for="km">Aracın KM</label><input id="km">
            <label for="fuel">Yakıt Miktarı</label><input id="fuel">
            <div class="ql-editor" contenteditable="true"></div>
    ''' + photo_inputs + '''
            <button onclick="advance()">İlerlet</button>
        </div>
        <script>
            window.clickCount = 0;
            function advance() {
                window.clickCount++;
                window.submitted = {
                    km: document.querySelector('#km').value,
                    fuel: document.querySelector('#fuel').value,
                    photos: Array.from(document.querySelectorAll('input[type=file]'))
                        .map(input => input.files.length)
                };
                setTimeout(() => document.querySelector('#modal').remove(), 500);
            }
        </script>
    ''')
    context = WorkflowContext(workflow_key="standart_yikama", selected_plate="06TST201")
    modal = FaytModal(local_page)
    assert modal.validation_messages() == ""

    FaytPage(local_page).process_open_modal(modal, context)

    submitted = local_page.evaluate('window.submitted')
    assert int(submitted['km']) >= 21400
    assert submitted['fuel'] == '4'
    assert submitted['photos'] == [1] * 6
    assert local_page.evaluate('window.clickCount') == 1
    assert context.values['washing_advance_filled'] == 'true'
    assert 'washing_close_filled' not in context.values
    assert 'maintenance_final_km' not in context.values


def test_electric_washing_without_photos_types_numeric_fuel(local_page):
    local_page.set_content('''
        <div class="v-dialog v-overlay--active" role="dialog" id="modal">
            <h2>Kilometre</h2><span>80112</span>
            <span>Yakıt Tipi</span><span>Elektrikli</span>
            <label for="km">Aracın KM</label><input id="km" value="80112">
            <label for="fuel">Yakıt Miktarı</label>
            <input id="fuel" onkeydown="this.dataset.typed = 'true'"
                   oninput="if (!this.dataset.typed) this.value = ''">
            <div class="ql-editor" contenteditable="true"></div>
            <button onclick="advanceWithoutPhotos()">İlerlet</button>
        </div>
        <script>
            function advanceWithoutPhotos() {
                window.advancedWithoutPhotos = {
                    km: document.querySelector('#km').value,
                    fuel: document.querySelector('#fuel').value
                };
                document.querySelector('#modal').remove();
            }
        </script>
    ''')
    context = WorkflowContext(
        workflow_key="standart_yikama",
        selected_vehicle="34SLA120 - PEUGEOT 2011 (2 / Elektrikli)",
        selected_plate="34SLA120",
        final_km=80112,
    )

    FaytPage(local_page).process_open_modal(FaytModal(local_page), context)

    submitted = local_page.evaluate('window.advancedWithoutPhotos')
    assert int(submitted['km']) == 80112
    assert submitted['fuel'] == '4'
    assert context.values['washing_advance_filled'] == 'true'
    assert not context.request_closed


def test_washing_close_skips_incidental_file_input_and_closes(local_page):
    local_page.set_content('''
        <div class="v-dialog v-overlay--active" role="dialog" id="modal">
            <h1>Araç Talebini Kapat</h1>
            <h2>Kilometre</h2><span>82243</span>
            <label for="close-km">Aracın KM</label><input id="close-km">
            <label for="close-fuel">Yakıt Miktarı</label><input id="close-fuel">
            <input id="vehicle-image-input" type="file">
            <div class="ql-editor" contenteditable="true"></div>
            <button onclick="closeWashing()">Kapat</button>
        </div>
        <script>
            function closeWashing() {
                window.closedWashing = {
                    km: document.querySelector('#close-km').value,
                    fuel: document.querySelector('#close-fuel').value,
                    incidentalFileCount:
                        document.querySelector('#vehicle-image-input').files.length
                };
                document.querySelector('#modal').remove();
            }
        </script>
    ''')
    context = WorkflowContext(
        workflow_key="standart_yikama",
        selected_plate="34SLA121",
        final_km=82243,
    )

    FaytPage(local_page).process_open_modal(FaytModal(local_page), context)

    submitted = local_page.evaluate('window.closedWashing')
    assert int(submitted['km']) > 82243
    assert submitted['fuel'] == '4'
    assert submitted['incidentalFileCount'] == 0
    assert context.values['washing_close_filled'] == 'true'
    assert context.request_closed


def test_washing_close_uploads_required_photo_fields_before_closing(local_page):
    photo_inputs = ''.join(
        f'<input type="file" id="close-photo-{index}" required>'
        for index in range(6)
    )
    local_page.set_content('''
        <div class="v-dialog v-overlay--active" role="dialog" id="modal">
            <h1>Araç Talebini Kapat</h1>
            <h2>Kilometre</h2><span>18613</span>
            <label for="close-km">Aracın KM</label><input id="close-km">
            <label for="close-fuel">Yakıt Miktarı</label><input id="close-fuel">
    ''' + photo_inputs + '''
            <div class="ql-editor" contenteditable="true"></div>
            <button onclick="closeWashingWithPhotos()">Kapat</button>
        </div>
        <script>
            function closeWashingWithPhotos() {
                window.closedWashingWithPhotos = {
                    km: document.querySelector('#close-km').value,
                    fuel: document.querySelector('#close-fuel').value,
                    photos: Array.from(document.querySelectorAll(
                        "input[type='file'][required]"
                    )).map(input => input.files.length)
                };
                document.querySelector('#modal').remove();
            }
        </script>
    ''')
    context = WorkflowContext(
        workflow_key="standart_yikama",
        selected_plate="06TST101",
        final_km=18613,
    )

    FaytPage(local_page).process_open_modal(FaytModal(local_page), context)

    submitted = local_page.evaluate('window.closedWashingWithPhotos')
    assert int(submitted['km']) > 18613
    assert submitted['fuel'] == '4'
    assert submitted['photos'] == [1] * 6
    assert context.values['washing_close_filled'] == 'true'
    assert context.request_closed


def test_washing_close_waits_for_delayed_fields_and_photos(local_page):
    local_page.set_content('''
        <div class="v-dialog v-overlay--active" role="dialog" id="modal">
            <h1>Araç Talebini Kapat</h1>
            <div id="dynamic-fields"></div>
            <button onclick="closeDelayedWashing()">Kapat</button>
        </div>
        <script>
            setTimeout(() => {
                const photoInputs = Array.from({length: 6}, (_, index) =>
                    `<input type="file" id="delayed-close-photo-${index}" required>`
                ).join('');
                document.querySelector('#dynamic-fields').innerHTML = `
                    <h2>Kilometre</h2><span>9859</span>
                    <label for="delayed-close-km">Aracın KM</label>
                    <input id="delayed-close-km" value="9859">
                    <label for="delayed-close-fuel">Yakıt Miktarı</label>
                    <input id="delayed-close-fuel">
                    ${photoInputs}
                    <div class="ql-editor" contenteditable="true"></div>
                `;
            }, 150);

            function closeDelayedWashing() {
                window.closedDelayedWashing = {
                    km: document.querySelector('#delayed-close-km').value,
                    fuel: document.querySelector('#delayed-close-fuel').value,
                    photos: Array.from(document.querySelectorAll(
                        "input[type='file'][required]"
                    )).map(input => input.files.length)
                };
                document.querySelector('#modal').remove();
            }
        </script>
    ''')
    context = WorkflowContext(
        workflow_key="standart_yikama",
        selected_vehicle="06TST206 - HONDA CİVİC (2 / Hibrit)",
        selected_plate="06TST206",
    )

    FaytPage(local_page).process_open_modal(FaytModal(local_page), context)

    submitted = local_page.evaluate('window.closedDelayedWashing')
    assert int(submitted['km']) >= 9859
    assert submitted['fuel'] == '4'
    assert submitted['photos'] == [1] * 6
    assert context.values['washing_close_filled'] == 'true'
    assert context.request_closed


def test_washing_close_uploads_six_files_to_single_multiple_input(local_page):
    local_page.set_content('''
        <div class="v-dialog v-overlay--active" role="dialog" id="modal">
            <h1>Araç Talebini Kapat</h1>
            <h2>Kilometre</h2><span>82243</span>
            <label for="close-km">Aracın KM</label><input id="close-km">
            <label for="close-fuel">Yakıt Miktarı</label><input id="close-fuel">
            <input id="vehicle-photos" type="file" multiple>
            <div class="ql-editor" contenteditable="true"></div>
            <button onclick="closeWashingWithMultipleInput()">Kapat</button>
        </div>
        <script>
            function closeWashingWithMultipleInput() {
                window.closedWashingWithMultipleInput = {
                    km: document.querySelector('#close-km').value,
                    fuel: document.querySelector('#close-fuel').value,
                    photos: document.querySelector('#vehicle-photos').files.length
                };
                document.querySelector('#modal').remove();
            }
        </script>
    ''')
    context = WorkflowContext(
        workflow_key="standart_yikama",
        selected_plate="34SLA121",
        final_km=82243,
    )

    FaytPage(local_page).process_open_modal(FaytModal(local_page), context)

    submitted = local_page.evaluate('window.closedWashingWithMultipleInput')
    assert int(submitted['km']) > 82243
    assert submitted['fuel'] == '4'
    assert submitted['photos'] == 6
    assert context.values['washing_close_filled'] == 'true'
    assert context.request_closed


def test_rental_return_fuel_request_uploads_required_vehicle_photos(local_page):
    local_page.set_content('''
        <div class="v-dialog v-overlay--active" role="dialog" id="modal">
            <label for="vehicle">Araç</label><input id="vehicle" value="06TST201">
            <label for="fuel-level">Yakıt Seviyesi (1-8)</label>
            <input id="fuel-level" type="number">
            <input id="fuel-photos" type="file" multiple hidden
                   onchange="document.querySelector('#fuel-level').value = ''">
            <button aria-label="Araç Fotoğrafları"
                    onclick="document.querySelector('#fuel-photos').click()">
                <i class="mdi-paperclip"></i>Araç Fotoğrafları
            </button>
            <div class="ql-editor" contenteditable="true"></div>
            <button onclick="saveRequest()">Kaydet</button>
        </div>
        <script>
            function saveRequest() {
                window.uploadedPhotos = document.querySelector('#fuel-photos').files.length;
                window.fuelLevel = document.querySelector('#fuel-level').value;
                document.querySelector('#modal').remove();
            }
        </script>
    ''')
    context = WorkflowContext(
        workflow_key="kiralama_donusu_yakit_alma",
        selected_vehicle="06TST201 - HYUNDAI İ20 (2 / Benzin)",
        selected_plate="06TST201",
    )

    FaytPage(local_page).process_open_modal(FaytModal(local_page), context)

    assert local_page.evaluate('window.uploadedPhotos') == 6
    assert local_page.evaluate('window.fuelLevel') == '4'
    assert context.values['fuel_request_photos'] == 'true'
    assert context.values['fuel_level'] == '4'
    assert 'washing_request_photos' not in context.values


def test_rental_return_fuel_condition_handles_unlabeled_km_and_fuel(local_page):
    photo_inputs = ''.join(
        f'''<input type="file" id="condition-photo-{index}" required
                   onchange="document.querySelector('#condition-km').value = '';
                       document.querySelector('#condition-fuel').value = ''">'''
        for index in range(6)
    )
    local_page.set_content('''
        <div class="v-dialog v-overlay--active" role="dialog" id="modal">
            <h2>Kilometre</h2><span>18500</span>
            <input class="v-field__input" id="condition-km" value="18500">
            <input class="v-field__input" id="condition-fuel" value="8">
    ''' + photo_inputs + '''
            <div class="ql-editor" contenteditable="true"></div>
            <button onclick="advanceFuel()">İlerlet</button>
        </div>
        <script>
            function advanceFuel() {
                window.fuelCondition = {
                    km: document.querySelector('#condition-km').value,
                    fuel: document.querySelector('#condition-fuel').value,
                    photos: Array.from(document.querySelectorAll('input[type=file]'))
                        .map(input => input.files.length)
                };
                document.querySelector('#modal').remove();
            }
        </script>
    ''')
    context = WorkflowContext(
        workflow_key="kiralama_donusu_yakit_alma",
        selected_vehicle="06TST101 - TOYOTA COROLLA (2 / Benzin)",
        selected_plate="06TST101",
    )

    FaytPage(local_page).process_open_modal(FaytModal(local_page), context)

    condition = local_page.evaluate('window.fuelCondition')
    assert int(condition['km']) >= 18500
    assert condition['fuel'] == '4'
    assert condition['photos'] == [1] * 6
    assert context.values['fuel_advance_filled'] == 'true'


def test_reopened_fuel_condition_refills_new_required_photo_inputs(local_page):
    photo_inputs = ''.join(
        f'<input type="file" id="reopened-photo-{index}" required>'
        for index in range(6)
    )
    local_page.set_content('''
        <div class="v-dialog v-overlay--active" role="dialog" id="modal">
            <h2>Kilometre</h2><span>18600</span>
            <input class="v-field__input" id="reopened-km" value="18600">
            <input class="v-field__input" id="reopened-fuel" value="8">
    ''' + photo_inputs + '''
            <div class="ql-editor" contenteditable="true"></div>
            <button onclick="advanceFuelAgain()">İlerlet</button>
        </div>
        <script>
            function advanceFuelAgain() {
                window.reopenedFuelCondition = {
                    km: document.querySelector('#reopened-km').value,
                    fuel: document.querySelector('#reopened-fuel').value,
                    photos: Array.from(document.querySelectorAll('input[type=file]'))
                        .map(input => input.files.length)
                };
                document.querySelector('#modal').remove();
            }
        </script>
    ''')
    context = WorkflowContext(
        workflow_key="kiralama_donusu_yakit_alma",
        selected_vehicle="06TST101 - TOYOTA COROLLA (2 / Benzin)",
        selected_plate="06TST101",
        final_km=18550,
        values={"fuel_advance_filled": "true"},
    )

    FaytPage(local_page).process_open_modal(FaytModal(local_page), context)

    condition = local_page.evaluate('window.reopenedFuelCondition')
    assert int(condition['km']) > 18600
    assert condition['fuel'] == '4'
    assert condition['photos'] == [1] * 6


def test_labeled_fuel_advance_still_uploads_required_photos(local_page):
    photo_inputs = ''.join(
        f'<input type="file" id="labeled-photo-{index}" required>'
        for index in range(6)
    )
    local_page.set_content('''
        <div class="v-dialog v-overlay--active" role="dialog" id="modal">
            <h2>Kilometre</h2><span>4200</span>
            <input aria-label="Aracın KM" id="labeled-km" value="4200">
            <input aria-label="Yakıt Miktarı" id="labeled-fuel" value="4">
    ''' + photo_inputs + '''
            <button onclick="advanceLabeledFuel()">İlerlet</button>
        </div>
        <script>
            function advanceLabeledFuel() {
                window.labeledFuelCondition = {
                    km: document.querySelector('#labeled-km').value,
                    fuel: document.querySelector('#labeled-fuel').value,
                    photos: Array.from(document.querySelectorAll('input[type=file]'))
                        .map(input => input.files.length)
                };
                document.querySelector('#modal').remove();
            }
        </script>
    ''')
    context = WorkflowContext(
        workflow_key="kiralama_donusu_yakit_alma",
        selected_plate="06TST105",
    )

    FaytPage(local_page).process_open_modal(FaytModal(local_page), context)

    condition = local_page.evaluate('window.labeledFuelCondition')
    assert int(condition['km']) > 4200
    assert condition['fuel'] == '4'
    assert condition['photos'] == [1] * 6


def test_rental_return_fuel_close_refills_km_before_closing(local_page):
    local_page.set_content('''
        <div class="v-dialog v-overlay--active" role="dialog" id="modal">
            <h2>Kilometre</h2><span>23553</span>
            <label for="close-km">Aracın KM</label><input id="close-km">
            <label for="close-fuel">Yakıt Miktarı</label><input id="close-fuel">
            <button onclick="closeFuel()">Kapat</button>
        </div>
        <script>
            function closeFuel() {
                window.closedFuel = {
                    km: document.querySelector('#close-km').value,
                    fuel: document.querySelector('#close-fuel').value,
                };
                document.querySelector('#modal').remove();
            }
        </script>
    ''')
    context = WorkflowContext(
        workflow_key="kiralama_donusu_yakit_alma",
        selected_plate="67LSA678",
        final_km=23553,
    )

    FaytPage(local_page).process_open_modal(FaytModal(local_page), context)

    closed = local_page.evaluate('window.closedFuel')
    assert int(closed['km']) > 23553
    assert closed['fuel'] == '4'
    assert context.values['fuel_close_filled'] == 'true'
    assert context.request_closed


def test_delayed_fuel_field_is_waited_for_before_advancing(local_page):
    photo_inputs = ''.join(
        f'<input type="file" id="delayed-photo-{index}" required>'
        for index in range(6)
    )
    local_page.set_content('''
        <div class="v-dialog v-overlay--active" role="dialog" id="modal">
            <h2>Kilometre</h2><span>12000</span>
            <label for="delayed-km">Aracın KM</label>
            <input id="delayed-km" value="12000">
            <div id="fuel-slot"></div>
    ''' + photo_inputs + '''
            <button onclick="advanceDelayedFuel()">İlerlet</button>
        </div>
        <script>
            setTimeout(() => {
                document.querySelector('#fuel-slot').innerHTML =
                    '<label for="delayed-fuel">Yakıt Miktarı</label>' +
                    '<input id="delayed-fuel">';
            }, 150);
            function advanceDelayedFuel() {
                window.delayedFuel = document.querySelector('#delayed-fuel').value;
                document.querySelector('#modal').remove();
            }
        </script>
    ''')
    context = WorkflowContext(
        workflow_key="kiralama_donusu_yakit_alma",
        selected_plate="06TST206",
    )

    FaytPage(local_page).process_open_modal(FaytModal(local_page), context)

    assert local_page.evaluate('window.delayedFuel') == '4'
    assert context.values['fuel_advance_filled'] == 'true'


def test_final_fuel_modal_refills_delivery_person_and_numeric_fields(
    local_page, monkeypatch
):
    local_page.set_content('''
        <div class="v-dialog v-overlay--active" role="dialog" id="modal">
            <h2>Kilometre</h2><span>22000</span>
            <label for="delivery">Teslim Yapacak Kişi</label>
            <input id="delivery">
            <label for="close-km">Aracın KM</label><input id="close-km">
            <label for="close-fuel">Yakıt Miktarı</label>
            <input id="close-fuel" value="0">
            <button onclick="closeFinalFuel()">Kapat</button>
        </div>
        <script>
            function closeFinalFuel() {
                window.finalFuel = {
                    delivery: document.querySelector('#delivery').value,
                    km: document.querySelector('#close-km').value,
                    fuel: document.querySelector('#close-fuel').value,
                };
                document.querySelector('#modal').remove();
            }
        </script>
    ''')
    context = WorkflowContext(
        workflow_key="kiralama_donusu_yakit_alma",
        selected_plate="06TST207",
        values={"delivery_person": "Önceki modalın kişisi"},
    )
    modal = FaytModal(local_page)

    def select_delivery(locator, _field_name, *_args, **_kwargs):
        locator.fill("Yeni Teslim Kişisi")
        return "Yeni Teslim Kişisi"

    monkeypatch.setattr(modal, "choose_random_option", select_delivery)
    FaytPage(local_page).process_open_modal(modal, context)

    submitted = local_page.evaluate('window.finalFuel')
    assert submitted['delivery'] == 'Yeni Teslim Kişisi'
    assert int(submitted['km']) > 22000
    assert submitted['fuel'] == '4'
    assert context.values['fuel_close_filled'] == 'true'
    assert context.request_closed


def test_onayla_waits_for_loading_dialog_to_close_and_clicks_once(local_page):
    local_page.set_content('''
        <div class="v-dialog v-overlay--active" role="dialog" id="modal">
            <button id="approve" onclick="approveOnce()">Onayla</button>
        </div>
        <script>
            window.approveCount = 0;
            function approveOnce() {
                window.approveCount++;
                const button = document.querySelector('#approve');
                button.classList.add('v-btn--loading');
                button.setAttribute('aria-busy', 'true');
                button.textContent = '';
                setTimeout(() => document.querySelector('#modal').remove(), 300);
            }
        </script>
    ''')

    FaytModal(local_page).onayla()

    assert local_page.evaluate('window.approveCount') == 1
    assert local_page.locator('#modal').count() == 0


def test_fuel_approval_summary_is_not_treated_as_condition_form(
    local_page, monkeypatch
):
    local_page.set_content('''
        <div class="v-dialog v-overlay--active" role="dialog" id="modal">
            <button aria-label="Kapat"><span>Kapat</span></button>
            <label for="historical-km">Aracın KM</label>
            <input id="historical-km" value="1450020" readonly>
            <button onclick="document.querySelector('#modal').remove()">Onayla</button>
        </div>
    ''')
    context = WorkflowContext(
        workflow_key="kiralama_donusu_yakit_alma",
        selected_plate="06TST208",
    )
    modal = FaytModal(local_page)
    monkeypatch.setattr(modal, "wait_for_dynamic_fuel_step", lambda: False)

    assert not modal.has_button("Kapat")

    FaytPage(local_page).process_open_modal(modal, context)

    assert local_page.locator('#modal').count() == 0


def test_fuel_field_wait_stops_when_dynamic_approval_appears(local_page):
    local_page.set_content('''
        <div class="v-dialog v-overlay--active" role="dialog" id="modal">
            <label for="historical-km">Aracın KM</label>
            <input id="historical-km" value="1450020" readonly>
            <button id="temporary-action">Kapat</button>
        </div>
        <script>
            setTimeout(() => {
                const button = document.querySelector('#temporary-action');
                button.textContent = 'Onayla';
            }, 150);
        </script>
    ''')

    fields = FaytModal(local_page).wait_for_fuel_condition_fields(timeout=2_000)

    assert fields is None


def test_transient_fuel_approval_waits_for_real_step(local_page):
    local_page.set_content('''
        <div class="v-dialog v-overlay--active" role="dialog" id="modal">
            <button id="action">Onayla</button>
        </div>
        <script>
            setTimeout(() => {
                document.querySelector('#action').textContent = 'İlerlet';
                for (let index = 0; index < 6; index++) {
                    const input = document.createElement('input');
                    input.type = 'file';
                    document.querySelector('#modal').appendChild(input);
                }
            }, 100);
        </script>
    ''')

    assert FaytModal(local_page).wait_for_dynamic_fuel_step(timeout=1_000)
    assert local_page.get_by_role("button", name="İlerlet").is_visible()


def test_actual_error_alert_is_still_reported(local_page):
    local_page.set_content('''
        <div role="alert" class="v-alert text-info">Genel Merkez</div>
        <div role="alert" class="v-alert text-error">Kilometre geçersiz</div>
    ''')
    assert FaytModal(local_page).validation_messages() == "Kilometre geçersiz"


def test_close_waits_for_modal_before_finishing(local_page):
    local_page.set_content('''
        <div class="v-dialog v-overlay--active" role="dialog" id="modal">
            <p id="status">Talep</p>
            <button onclick="
                document.querySelector('#status').textContent = 'Kapatılıyor';
                setTimeout(() => document.querySelector('#modal').remove(), 400);
            ">Kapat</button>
        </div>
    ''')
    context = WorkflowContext(workflow_key="standart_yikama")
    FaytPage(local_page).process_open_modal(FaytModal(local_page), context)
    assert context.request_closed
    assert local_page.locator('#modal').count() == 0


def test_closed_request_does_not_search_or_advance_again():
    from unittest.mock import Mock

    fayt = FaytPage(Mock())
    fayt.open_workflow = Mock(return_value=FaytPage.STANDART_YIKAMA)
    fayt.start_request = Mock()
    fayt.advance_selected_request = Mock(return_value=True)

    def process(modal, context):
        if context.selected_plate is None:
            context.selected_plate = '06TST201'
        else:
            context.request_closed = True
        return context

    fayt.process_open_modal = Mock(side_effect=process)
    context = fayt.standart_yikama()
    assert context.request_closed
    fayt.advance_selected_request.assert_called_once_with('06TST201')
