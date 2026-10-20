"""Canlı kayıt oluşturmadan tarih ve GET → POST eşleşmesini kontrol et."""

import json
from datetime import date
from types import SimpleNamespace
from xml.etree import ElementTree

import pytest

from tests.api import booking_data
from tests.api.booking_data import (
    AVAILABLE_PATH,
    CANCEL_PATH,
    first_bookable_car,
    save_params,
    search_params,
    xml_has_error,
)
from tests.api.conftest import _safe_connection_reason, broker_api as broker_api_fixture
from tests.api.test_rezervasyon_kaydet import _customer_from_env
from utils.config_reader import Config


def test_yil_degisiminde_tarihler_ileri_gider(monkeypatch):
    monkeypatch.setenv("BROKER_DAYS_AHEAD", "7")
    monkeypatch.setenv("BROKER_RENTAL_DAYS", "2")

    params = search_params(today=date(2026, 12, 28))

    assert (params["Pickup_Day"], params["Pickup_Month"], params["Pickup_Year"]) == (
        "4", "1", "2027"
    )
    assert (params["Drop_Off_Day"], params["Drop_Off_Month"], params["Drop_Off_Year"]) == (
        "6", "1", "2027"
    )


def test_gecmis_ve_bugun_icin_arama_yapilamaz(monkeypatch):
    monkeypatch.setenv("BROKER_DAYS_AHEAD", "0")
    with pytest.raises(AssertionError, match="BROKER_DAYS_AHEAD"):
        search_params(today=date(2026, 10, 15))


def test_aracin_rez_ve_grup_kimligi_tarihlerle_birlikte_posta_tasinir(monkeypatch):
    monkeypatch.delenv("BROKER_ECOP_ID", raising=False)
    monkeypatch.delenv("BROKER_FULL_CREDIT", raising=False)
    search = search_params(today=date(2026, 10, 15))
    root = ElementTree.fromstring(
        "<Turevsistem><Car><Rez_ID>TRS-ABC</Rez_ID>"
        "<Group_ID>GRUP-1</Group_ID></Car></Turevsistem>"
    )
    car = first_bookable_car(root.findall("Car"))
    customer = {
        "Rental_ID": "TEST-PASAPORT",
        "Name": "Test",
        "SurName": "Kullanici",
        "MobilePhone": "5550000000",
        "Mail_Adress": "test@example.invalid",
    }

    post = save_params(search, car, customer)

    assert all(post[key] == value for key, value in search.items())
    assert post["Rez_ID"] == "TRS-ABC"
    assert post["Group_ID"] == "GRUP-1"
    assert post["Rental_ID"] == "TEST-PASAPORT"
    assert post["Ecop_ID"] == "Korall55"
    assert "Full_Credit" not in post

    monkeypatch.setenv("BROKER_FULL_CREDIT", "true")
    assert save_params(search, car, customer)["Full_Credit"] == "TRUE"


def test_xml_icindeki_hata_ogesi_yakalanir():
    root = ElementTree.fromstring(
        "<Turevsistem><error>Rezervasyon yapılamadı</error></Turevsistem>"
    )
    assert xml_has_error(root)


def test_basarisiz_kayit_iptal_hedefi_olmaz(monkeypatch, tmp_path):
    latest = tmp_path / "son_rezervasyon.json"
    monkeypatch.setattr(booking_data, "LATEST_BOOKING", latest)
    receipt = {"Rez_ID": "TRS-TEST", "state": "save_http_error"}

    booking_data.write_booking_receipt(receipt)
    assert not latest.exists()

    receipt["state"] = "save_xml_key_status_matched"
    booking_data.write_booking_receipt(receipt, update_latest=True)
    assert latest.exists()


def test_gitlab_iptal_aktariminda_musteri_alanlari_yok(monkeypatch, tmp_path):
    latest = tmp_path / "son_rezervasyon.json"
    handoff = tmp_path / "ci_cancel_receipt.json"
    monkeypatch.setattr(booking_data, "LATEST_BOOKING", latest)
    monkeypatch.setattr(booking_data, "CI_CANCEL_RECEIPT", handoff)
    booking_data.write_booking_receipt(
        {
            "Rez_ID": "TRS-ORNEK",
            "environment": "dev",
            "state": "save_xml_key_status_matched",
            "generated_test_passport_id": "T12345678",
            "Name": "Ornek",
        },
        update_latest=True,
    )

    booking_data.export_ci_cancel_receipt()

    assert json.loads(handoff.read_text(encoding="utf-8")) == {
        "Rez_ID": "TRS-ORNEK",
        "environment": "dev",
        "state": "save_xml_key_status_matched",
    }


def test_her_calismada_yeni_test_pasaport_idsi_uretilir(monkeypatch):
    monkeypatch.setenv("BROKER_GENERATE_RENTAL_ID", "true")
    monkeypatch.setenv("BROKER_TEST_NAME", "Test")
    monkeypatch.setenv("BROKER_TEST_SURNAME", "Kullanici")
    monkeypatch.setenv("BROKER_TEST_MOBILE_PHONE", "5550000000")
    monkeypatch.setenv("BROKER_TEST_EMAIL", "test@example.invalid")
    monkeypatch.setattr(
        "tests.api.test_rezervasyon_kaydet.secrets.randbelow", lambda limit: 12345678
    )

    customer, generated = _customer_from_env()

    assert generated
    assert customer["Rental_ID"] == "T12345678"


def test_ag_hatasi_gizli_basligi_gostermez():
    error = RuntimeError(
        "APIRequestContext.fetch: socket hang up\n"
        "Authorization: Token ornek-gizli-deger"
    )

    reason = _safe_connection_reason(error)

    assert reason == "bağlantı sunucu tarafından kapatıldı"
    assert "ornek-gizli-deger" not in reason


def test_gitlabda_broker_ayari_eksikse_test_atlanmaz(monkeypatch):
    monkeypatch.setenv("CI", "true")
    monkeypatch.delenv("BROKER_TOKEN", raising=False)
    monkeypatch.setenv("BROKER_COMPANY_ID", "ornek-sirket")
    monkeypatch.setenv("BROKER_APPLICATION_ID", "ornek-uygulama")

    with pytest.raises(pytest.fail.Exception, match="BROKER_TOKEN"):
        next(broker_api_fixture.__wrapped__(None))


def test_yalniz_musait_arac_get_istegi_tekrar_dener(monkeypatch):
    """Yanıt kaybolduğunda iptal isteği ikinci kez gönderilmemeli."""
    monkeypatch.setenv("BROKER_TOKEN", "ornek-gizli-deger")
    monkeypatch.setenv("BROKER_COMPANY_ID", "ornek-sirket")
    monkeypatch.setenv("BROKER_APPLICATION_ID", "ornek-uygulama")
    monkeypatch.setattr(Config, "BASE_URL", "https://example.invalid")

    class FakeContext:
        def __init__(self):
            self.paths = []

        def fetch(self, path, **kwargs):
            self.paths.append(path)
            if path == AVAILABLE_PATH and self.paths.count(path) == 1:
                raise RuntimeError("socket hang up")
            if path == CANCEL_PATH:
                raise RuntimeError("socket hang up\nAuthorization: Token ornek-gizli-deger")
            return object()

        def dispose(self):
            pass

    context = FakeContext()
    playwright = SimpleNamespace(
        request=SimpleNamespace(new_context=lambda **kwargs: context)
    )
    fixture = broker_api_fixture.__wrapped__(playwright)
    client = next(fixture)

    client.get(AVAILABLE_PATH, retry_once=True)
    with pytest.raises(AssertionError, match="1 denemede") as error:
        client.get(CANCEL_PATH, params={"Rez_ID": "ORNEK"})

    assert context.paths == [AVAILABLE_PATH, AVAILABLE_PATH, CANCEL_PATH]
    assert "ornek-gizli-deger" not in str(error.value)
    next(fixture, None)
