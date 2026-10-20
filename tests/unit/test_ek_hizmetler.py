from unittest.mock import Mock

import pytest
from playwright.sync_api import sync_playwright

from components.ek_hizmetler import EkHizmetler
from components.tarih_sec import TarihSec


@pytest.fixture
def local_page():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()
        yield page
        browser.close()


def test_only_checkbox_inside_additional_services_is_selected(local_page):
    local_page.set_content("""
        <label><input type="checkbox" id="payment">Ödemeyi Sonra Al</label>
        <section id="services">
            <h2>Ek Hizmet ve Teklifler</h2>
            <label><input type="checkbox" id="baby">Bebek Koltuğu</label>
            <label><input type="checkbox" id="driver">Ek Sürücü</label>
            <label><input type="checkbox" id="winter" disabled>Kış Lastiği</label>
        </section>
    """)
    rng = Mock()
    rng.choice.side_effect = lambda candidates: candidates[0]

    selected = EkHizmetler(local_page, rng=rng).rastgele_sec()

    assert selected == "Bebek Koltuğu"
    assert local_page.locator("#baby").is_checked()
    assert not local_page.locator("#driver").is_checked()
    assert not local_page.locator("#payment").is_checked()


def test_fails_when_no_selectable_service_exists(local_page):
    local_page.set_content("""
        <section>
            <h2>Ek Hizmet ve Teklifler</h2>
            <label><input type="checkbox">Ek Sürücü</label>
            <label><input type="checkbox" disabled>Kış Lastiği</label>
        </section>
    """)

    with pytest.raises(AssertionError, match="seçilebilir ek hizmet bulunamadı"):
        EkHizmetler(local_page).rastgele_sec()


def test_selects_one_non_driver_service_for_each_visible_month(local_page):
    local_page.set_content("""
        <button id="bulk" role="tab" aria-selected="true">Toplu İşlem</button>
        <button id="monthly" role="tab" aria-selected="false">Aylık Özelleştir</button>

        <section id="services">
            <h2>Ek Hizmet ve Teklifler</h2>

            <div id="month-tabs" role="tablist" hidden>
                <button role="tab" data-month="october" aria-selected="false">Ekim</button>
                <button role="tab" data-month="november" aria-selected="false">Kasım</button>
            </div>

            <div data-panel="october" hidden>
                <label><input id="october-driver" type="checkbox">Ek Sürücü</label>
                <label><input id="october-baby" type="checkbox">Bebek Koltuğu</label>
            </div>

            <div data-panel="november" hidden>
                <label><input id="november-driver" type="checkbox">Ek Sürücü</label>
                <label><input id="november-scdw" type="checkbox">SCDW Hizmeti</label>
            </div>
        </section>

        <script>
            const bulk = document.querySelector('#bulk');
            const monthly = document.querySelector('#monthly');
            const monthTabs = document.querySelector('#month-tabs');

            function showMonth(month) {
                document.querySelectorAll('[data-panel]').forEach(panel => {
                    panel.hidden = panel.dataset.panel !== month;
                });
                document.querySelectorAll('[data-month]').forEach(tab => {
                    tab.setAttribute(
                        'aria-selected',
                        String(tab.dataset.month === month),
                    );
                });
            }

            monthly.addEventListener('click', () => {
                monthly.setAttribute('aria-selected', 'true');
                bulk.setAttribute('aria-selected', 'false');
                monthTabs.hidden = false;
                showMonth('october');
            });

            document.querySelectorAll('[data-month]').forEach(tab => {
                tab.addEventListener('click', () => showMonth(tab.dataset.month));
            });
        </script>
    """)
    rng = Mock()
    rng.choice.side_effect = lambda candidates: candidates[0]

    selections = EkHizmetler(
        local_page, rng=rng
    ).rezervasyona_gore_sec()

    assert selections == [
        {"donem": "Ekim", "hizmet": "Bebek Koltuğu"},
        {"donem": "Kasım", "hizmet": "SCDW Hizmeti"},
    ]
    assert local_page.locator("#october-baby").is_checked()
    assert local_page.locator("#november-scdw").is_checked()
    assert not local_page.locator("#october-driver").is_checked()
    assert not local_page.locator("#november-driver").is_checked()


def test_monthly_date_uses_two_thirty_day_periods(local_page):
    local_page.set_content("""
        <input placeholder="Başlangıç tarihi" value="05.10.2026">
        <input placeholder="Bitiş tarihi" value="04.02.2027">
        <input placeholder="Başlangıç saati" value="09:15">
        <input placeholder="Bitiş saati" value="09:27">
    """)

    TarihSec(local_page).tarih_ve_saat("Monthly", ay_sayisi=2)

    assert local_page.get_by_placeholder("Bitiş tarihi").input_value() == "04.12.2026"
    assert local_page.get_by_placeholder("Bitiş saati").input_value() == "09:15"


def test_monthly_services_exclude_extra_driver(local_page):
    local_page.set_content("""
        <h2>Ek hizmetler ve özel fiyat</h2>
        <button>Tüm rezervasyonlar</button>
        <button id="driver">Ek Sürücü 2 / 2 ₺</button>
        <button id="baby" onclick="this.setAttribute('aria-pressed', 'true')">
            Bebek Koltuğu 5 / 5 ₺
        </button>
    """)
    rng = Mock()
    rng.choice.side_effect = lambda candidates: candidates[0]

    selected = EkHizmetler(local_page, rng=rng).aylik_rezervasyonda_sec()

    assert selected == [{"donem": "Tüm rezervasyonlar", "hizmet": "Bebek Koltuğu"}]
    assert local_page.locator("#baby").get_attribute("aria-pressed") == "true"
    assert local_page.locator("#driver").get_attribute("aria-pressed") is None
