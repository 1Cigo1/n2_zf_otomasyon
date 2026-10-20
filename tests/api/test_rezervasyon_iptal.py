"""Daha önce kaydedilen rezervasyonu yalnız ayrı komutla iptal et."""

import json
import pytest

from tests.api.booking_data import (
    CANCEL_PATH,
    LATEST_BOOKING,
    write_booking_receipt,
    write_error_response,
    write_xml,
    xml_has_error,
)
from utils.config_reader import Config


def test_rezervasyon_iptal(request):
    if Config.ENVIRONMENT != "dev":
        pytest.skip("Rezervasyon iptali yalnız dev ortamında denenir.")
    if request.config.getoption("--run-broker-save"):
        pytest.skip("Kayıt ve iptal aynı test çalışmasında yapılmaz.")
    if not request.config.getoption("--run-broker-cancel"):
        pytest.skip("İptal için --run-broker-cancel seçeneği gerekli.")
    if not LATEST_BOOKING.exists():
        pytest.fail("İptal için önce rezervasyon kaydı çalıştırılmalı.")

    receipt = json.loads(LATEST_BOOKING.read_text(encoding="utf-8"))
    assert receipt.get("environment") == Config.ENVIRONMENT, (
        "Son rezervasyon bu test ortamında oluşturulmamış."
    )
    assert receipt["state"] == "save_xml_key_status_matched", (
        "Son rezervasyon daha önce iptal isteği almış veya kayıt durumu uygun değil."
    )
    rez_id = receipt["Rez_ID"]
    assert rez_id, "Yerel sonuç dosyasında Rez_ID bulunamadı."
    broker_api = request.getfixturevalue("broker_api")

    # Collection'da iptal yöntemi GET olsa da sunucuda kayıt değiştirir.
    response = broker_api.get(CANCEL_PATH, params={"Rez_ID": rez_id})
    if response.status != 200:
        error_path = write_error_response("rezervasyon_iptal_hata", response.body())
        pytest.fail(
            f"Rezervasyon iptal: HTTP {response.status}. "
            f"Yanıt: {error_path.resolve()}",
            pytrace=False,
        )
    xml_path, root = write_xml("rezervasyon_iptal.xml", response.body())
    if xml_has_error(root):
        pytest.fail(f"Rezervasyon iptal XML hata döndürdü: {xml_path.resolve()}", pytrace=False)

    receipt["state"] = "cancel_http_ok_business_result_unverified"
    write_booking_receipt(receipt, update_latest=True)
    print(
        f"\nİptal isteği gönderildi. Rez_ID: {rez_id}"
        f"\nİptal yanıt XML'i: {xml_path.resolve()}",
        flush=True,
    )
