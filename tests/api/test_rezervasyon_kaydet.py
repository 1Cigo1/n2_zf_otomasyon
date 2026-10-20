"""Müsait araçtan gelen Rez_ID ile isteğe bağlı rezervasyon oluştur."""

import os
import secrets
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from tests.api.booking_data import (
    AVAILABLE_PATH,
    SAVE_PATH,
    first_bookable_car,
    save_params,
    search_params,
    write_booking_receipt,
    write_error_response,
    write_xml,
    xml_has_error,
)
from tests.api.test_collection_get import xml_yaniti_goster
from utils.config_reader import Config


def _customer_from_env() -> tuple[dict[str, str], bool]:
    """POST'un istediği test müşteri alanlarını gizli yerel ayarlardan oku."""
    names = {
        "BROKER_TEST_NAME": "Name",
        "BROKER_TEST_SURNAME": "SurName",
        "BROKER_TEST_MOBILE_PHONE": "MobilePhone",
        "BROKER_TEST_EMAIL": "Mail_Adress",
    }
    missing = [name for name in names if not os.getenv(name, "").strip()]
    if missing:
        pytest.fail("POST için .env test müşteri ayarı eksik: " + ", ".join(missing))
    customer = {param: os.environ[env].strip() for env, param in names.items()}
    generated = os.getenv("BROKER_GENERATE_RENTAL_ID", "false").strip().lower() == "true"
    if generated:
        # Dev ortamında kabul edilen, her çalışmada yeni bir test pasaport ID'si.
        customer["Rental_ID"] = f"T{secrets.randbelow(100_000_000):08d}"
    else:
        rental_id = os.getenv("BROKER_TEST_RENTAL_ID", "").strip()
        if not rental_id:
            pytest.fail("POST için BROKER_TEST_RENTAL_ID gerekli.")
        customer["Rental_ID"] = rental_id
    return customer, generated


def test_rezervasyon_kaydet(request):
    if Config.ENVIRONMENT != "dev":
        pytest.skip("Rezervasyon kaydı yalnız dev ortamında denenir.")
    if not request.config.getoption("--run-broker-save"):
        pytest.skip("Kayıt için --run-broker-save seçeneği gerekli.")
    customer, generated_rental_id = _customer_from_env()
    broker_api = request.getfixturevalue("broker_api")

    # Rez_ID her müsait araç aramasında değişebilir: aynı testte yeni GET yap.
    search = search_params()
    available_response = broker_api.get(
        AVAILABLE_PATH, params=search, timeout=60_000, retry_once=True
    )
    cars = xml_yaniti_goster(
        available_response,
        "Kayıt öncesi müsait araçlar",
        "kayit_oncesi_musait_araclar",
        "Car",
        ("Rez_ID", "Group_ID", "Car_Name", "Brand", "Type"),
    )
    car = first_bookable_car(cars)
    params = save_params(search, car, customer)

    # GET ile POST'un ortak alanları aynı nesneden geldiği için birebir eşleşir.
    assert all(params[key] == value for key, value in search.items())
    assert params["Rez_ID"] == car.findtext("Rez_ID")
    assert params["Group_ID"] == car.findtext("Group_ID")

    receipt_data = {
        "Rez_ID": params["Rez_ID"],
        "Group_ID": params["Group_ID"],
        "search_params": search,
        "car_name": car.findtext("Car_Name"),
        "state": "save_request_prepared",
        "environment": Config.ENVIRONMENT,
        "created_at": datetime.now(ZoneInfo("Europe/Istanbul")).isoformat(),
    }
    if generated_rental_id:
        receipt_data["generated_test_passport_id"] = params["Rental_ID"]
    write_booking_receipt(receipt_data)

    # Collection'a göre POST'un HTTP Body'si boş; alanlar URL/Params'ta.
    response = broker_api.post(SAVE_PATH, params=params)
    receipt_data["save_http_status"] = response.status
    if response.status not in (200, 201):
        receipt_data["state"] = "save_http_error_business_result_unverified"
        write_booking_receipt(receipt_data)
        error_path = write_error_response("rezervasyon_kaydet_hata", response.body())
        pytest.fail(
            f"Rezervasyon kaydet: HTTP {response.status}. "
            f"Yanıt: {error_path.resolve()}",
            pytrace=False,
        )
    xml_path, root = write_xml("rezervasyon_kaydet.xml", response.body())
    if xml_has_error(root):
        receipt_data["state"] = "save_xml_error_business_result_unverified"
        write_booking_receipt(receipt_data)
        pytest.fail(f"Rezervasyon kaydet XML hata döndürdü: {xml_path.resolve()}", pytrace=False)

    if root.findtext("Key") != params["Rez_ID"] or root.findtext("Status") != "200":
        receipt_data["state"] = "save_xml_unexpected_business_result_unverified"
        write_booking_receipt(receipt_data)
        pytest.fail(
            f"Rezervasyon yanıtında Key/Status beklenen değerlerde değil: {xml_path.resolve()}",
            pytrace=False,
        )

    receipt_data["state"] = "save_xml_key_status_matched"
    receipt = write_booking_receipt(receipt_data, update_latest=True)
    print(
        f"\nRezervasyon kaydet isteği gönderildi. Rez_ID: {params['Rez_ID']}"
        f"\nPOST yanıt XML'i: {xml_path.resolve()}"
        f"\nSon rezervasyon kaydı: {receipt.resolve()}"
        "\nİptal isteği bu testte gönderilmedi.",
        flush=True,
    )
