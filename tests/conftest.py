import base64
import os
import re
from pathlib import Path

import pytest
import pytest_html

from utils.config_reader import Config


WRITE_TEST_FILES = {
    "test_02_reservation.py",
    "test_03_long_term_rental.py",
    "test_04_corporate.py",
    "test_05_Fayt.py",
    "test_06_Standart_Yikama.py",
    "test_07_Kiralama_Donusu_Yakit.py",
    "test_08_monthly_reservation.py",
    "test_rezervasyon_kaydet.py",
    "test_rezervasyon_iptal.py",
}


def _enabled(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _safe_file_name(value: str) -> str:
    """Test adındaki özel karakterleri güvenli dosya adına dönüştürür."""
    return re.sub(r"[^A-Za-z0-9_.-]+", "-", value).strip("-") or "test"


@pytest.hookimpl(optionalhook=True)
def pytest_html_report_title(report):
    """HTML raporunun tarayıcı sekmesinde test grubunun adını gösterir."""
    report_name = os.getenv("REPORT_NAME", "FYS Python Otomasyonu")
    report.title = f"{report_name} - Test Raporu"


def pytest_sessionstart(session):
    """Yerel ve CI rapor klasörlerini test başlamadan hazırlar."""
    Path("reports/html").mkdir(parents=True, exist_ok=True)
    Path(os.getenv("SCREENSHOT_DIR", "test-results/screenshots")).mkdir(
        parents=True,
        exist_ok=True,
    )


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Bir test hata verirse ekran görüntüsünü kaydeder ve HTML'e ekler."""
    outcome = yield
    test_report = outcome.get_result()

    # Fixture kurulumu/kapaması değil, test adımı başarısız olduğunda çalışır.
    if test_report.when != "call" or not test_report.failed:
        return

    page = item.funcargs.get("clean_page")
    if page is None or page.is_closed():
        return

    try:
        screenshot_dir = Path(
            os.getenv("SCREENSHOT_DIR", "test-results/screenshots")
        )
        screenshot_dir.mkdir(parents=True, exist_ok=True)

        report_name = _safe_file_name(os.getenv("REPORT_NAME", "pytest"))
        test_name = _safe_file_name(item.nodeid)
        screenshot_path = screenshot_dir / f"{report_name}-{test_name}.png"

        image_bytes = page.screenshot(path=str(screenshot_path), full_page=True)
        image_base64 = base64.b64encode(image_bytes).decode("ascii")

        environment_info = (
            f"TEST_ENV={Config.ENVIRONMENT}\n"
            f"ACTIVE_ROLE={Config.ACTIVE_ROLE}"
        )
        extras = getattr(test_report, "extras", [])
        extras.append(pytest_html.extras.png(image_base64, name="Hata ekranı"))
        extras.append(pytest_html.extras.url(page.url, name="Hata URL'si"))
        extras.append(pytest_html.extras.text(environment_info, name="Test ortamı"))
        test_report.extras = extras

        # Bu bölümler GitLab terminal çıktısında da görülebilir.
        test_report.sections.append(("Hata anındaki URL", page.url))
        test_report.sections.append(("Ekran görüntüsü", str(screenshot_path)))
    except Exception as error:
        # Raporlama hatası, asıl test hatasını gizlememeli.
        test_report.sections.append(
            ("Ekran görüntüsü alınamadı", f"{type(error).__name__}: {error}")
        )


def pytest_collection_modifyitems(items):
    """Gerçek veri yazan mevcut testleri açık izin olmadan çalıştırma."""
    if Config.E2E_ALLOW_WRITE:
        return

    write_disabled = pytest.mark.skip(
        reason="Bu test gerçek veri oluşturur; E2E_ALLOW_WRITE=true gerekli."
    )
    for item in items:
        if Path(str(item.fspath)).name in WRITE_TEST_FILES:
            item.add_marker(write_disabled)


@pytest.fixture(scope="function")
def step():
    """Test adımlarını terminal ve HTML raporunda numaralı olarak gösterir."""
    step_number = 0

    def report_step(message: str):
        nonlocal step_number
        step_number += 1
        print(f"\n[ADIM {step_number:02d}] {message}", flush=True)

    return report_step


@pytest.fixture(scope="session")
def browser(playwright):
    """Playwright eklentisinin artifact sistemiyle uyumlu tarayıcıyı açar."""
    browser_type = getattr(playwright, Config.BROWSER.lower())
    is_ci = _enabled(os.getenv("CI", "false"))
    headless = _enabled(os.getenv("HEADLESS", "true" if is_ci else "false"))
    launch_args = ["--disable-blink-features=AutomationControlled"]

    launched_browser = browser_type.launch(headless=headless, args=launch_args)
    try:
        yield launched_browser
    finally:
        launched_browser.close()


@pytest.fixture(scope="function")
def clean_page(new_context):
    """Her teste temiz oturum verir; trace/video yönetimini Playwright yapar."""
    context = new_context(ignore_https_errors=True)
    return context.new_page()
