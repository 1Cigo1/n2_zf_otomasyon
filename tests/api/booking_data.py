"""Müsait araç araması ile rezervasyonun ortak parametreleri."""

import json
import os
import re
from datetime import date, datetime, timedelta
from pathlib import Path
from xml.etree import ElementTree
from zoneinfo import ZoneInfo


AVAILABLE_PATH = "/api/broker-service/booking/"
SAVE_PATH = "/api/broker-service/booking-save/"
CANCEL_PATH = "/api/broker-service/booking_cancel/"

# Dev ortamında daha önce araç döndüren Ankara Çankaya ofisi.
DEFAULT_OFFICE_ID = "a4998532-0bed-4c4a-8fec-54f1cbb8a7c1"
LATEST_BOOKING = Path("reports/api_bookings/son_rezervasyon.json")
CI_CANCEL_RECEIPT = Path("reports/api_bookings/ci_cancel_receipt.json")


def _positive_number(env_name: str, default: int) -> int:
    value = os.getenv(env_name, str(default)).strip()
    assert value.isdecimal() and int(value) > 0, f"{env_name} pozitif sayı olmalı."
    return int(value)


def search_params(today: date | None = None) -> dict[str, str]:
    """Başlangıcı bugünden ileri, bitişi başlangıçtan ileri seç."""
    today = today or datetime.now(ZoneInfo("Europe/Istanbul")).date()
    pickup = today + timedelta(days=_positive_number("BROKER_DAYS_AHEAD", 7))
    dropoff = pickup + timedelta(days=_positive_number("BROKER_RENTAL_DAYS", 2))
    pickup_id = os.getenv("BROKER_PICKUP_ID", "").strip() or DEFAULT_OFFICE_ID
    dropoff_id = os.getenv("BROKER_DROP_OFF_ID", "").strip() or pickup_id
    currency = os.getenv("BROKER_CURRENCY", "TRY").strip().upper()
    assert currency in {"TRY", "EUR", "USD", "GBP"}, "BROKER_CURRENCY geçersiz."
    hour = os.getenv("BROKER_HOUR", "10").strip()
    assert hour.isdecimal() and 0 <= int(hour) <= 23, "BROKER_HOUR 0-23 olmalı."

    return {
        "Currency": currency,
        "Pickup_ID": pickup_id,
        "Pickup_Day": str(pickup.day),
        "Pickup_Month": str(pickup.month),
        "Pickup_Year": str(pickup.year),
        "Pickup_Hour": hour,
        "Pickup_Min": "00",
        "Drop_Off_ID": dropoff_id,
        "Drop_Off_Day": str(dropoff.day),
        "Drop_Off_Month": str(dropoff.month),
        "Drop_Off_Year": str(dropoff.year),
        "Drop_Off_Hour": hour,
        "Drop_Off_Min": "00",
    }


def first_bookable_car(cars):
    """GET yanıtında rezervasyon ve grup kimliği olan ilk aracı seç."""
    for car in cars:
        if car.findtext("Rez_ID") and car.findtext("Group_ID"):
            return car
    raise AssertionError("Müsait araçlarda Rez_ID ve Group_ID birlikte bulunamadı.")


def save_params(search: dict[str, str], car, customer: dict[str, str]) -> dict[str, str]:
    """GET tarihlerini değiştirmeden POST URL/Params alanına aktar."""
    params = search.copy()
    params.update(
        {
            "Rez_ID": car.findtext("Rez_ID"),
            "Group_ID": car.findtext("Group_ID"),
            "Rental_ID": customer["Rental_ID"],
            "Name": customer["Name"],
            "SurName": customer["SurName"],
            "MobilePhone": customer["MobilePhone"],
            "Mail_Adress": customer["Mail_Adress"],
            "Ecop_ID": os.getenv("BROKER_ECOP_ID", "").strip() or "Korall55",
        }
    )
    if os.getenv("BROKER_FULL_CREDIT", "").strip().lower() == "true":
        params["Full_Credit"] = "TRUE"
    return params


def write_xml(file_name: str, body: bytes) -> tuple[Path, ElementTree.Element]:
    """API'nin ürettiği XML'i okunur biçimde yerel rapora yaz."""
    root = ElementTree.fromstring(body)
    ElementTree.indent(root, space="  ")
    path = Path("reports/api_xml") / file_name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(ElementTree.tostring(root, encoding="unicode"), encoding="utf-8")
    path.chmod(0o600)
    return path, root


def write_error_response(file_stem: str, body: bytes) -> Path:
    """Hata XML değilse de sunucu yanıtını yerelde incelemek için sakla."""
    try:
        path, _ = write_xml(f"{file_stem}.xml", body)
        return path
    except ElementTree.ParseError:
        path = Path("reports/api_xml") / f"{file_stem}.txt"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body.decode("utf-8", errors="replace"), encoding="utf-8")
        path.chmod(0o600)
        return path


def xml_has_error(root: ElementTree.Element) -> bool:
    """HTTP 200 içinde gelen XML hata öğesini de yakala."""
    for element in root.iter():
        tag = element.tag.rsplit("}", 1)[-1].lower()
        if tag in {"error", "fault", "hata"}:
            return True
    return False


def write_booking_receipt(data: dict, update_latest: bool = False) -> Path:
    """Her denemeyi sakla; yalnız doğrulanan kaydı son iptal hedefi yap."""
    LATEST_BOOKING.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(data, ensure_ascii=False, indent=2)
    safe_id = re.sub(r"[^A-Za-z0-9_-]", "_", data["Rez_ID"])
    paths = [LATEST_BOOKING.parent / f"{safe_id}.json"]
    if update_latest:
        paths.append(LATEST_BOOKING)
    for path in paths:
        path.write_text(content, encoding="utf-8")
        path.chmod(0o600)
    return paths[-1]


def export_ci_cancel_receipt() -> Path:
    """GitLab iptal işi için yalnız gerekli üç alanı ayrı dosyaya aktar."""
    receipt = json.loads(LATEST_BOOKING.read_text(encoding="utf-8"))
    assert receipt.get("state") == "save_xml_key_status_matched", (
        "İptal aktarımı için doğrulanmış rezervasyon kaydı gerekli."
    )
    handoff = {
        key: receipt[key] for key in ("Rez_ID", "environment", "state")
    }
    assert handoff["Rez_ID"] and handoff["environment"]
    CI_CANCEL_RECEIPT.parent.mkdir(parents=True, exist_ok=True)
    CI_CANCEL_RECEIPT.write_text(
        json.dumps(handoff, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    CI_CANCEL_RECEIPT.chmod(0o600)
    return CI_CANCEL_RECEIPT
