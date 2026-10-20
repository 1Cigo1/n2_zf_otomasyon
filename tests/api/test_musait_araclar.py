"""Bugünden sonraki günler için müsait araçları XML olarak göster."""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from tests.api.booking_data import AVAILABLE_PATH, first_bookable_car, search_params
from tests.api.test_collection_get import xml_yaniti_goster


def test_musait_araclar(broker_api):
    # BROKER_DAYS_AHEAD=7 ve BROKER_RENTAL_DAYS=2 varsayılanları .env'de değişebilir.
    params = search_params()
    pickup = date(
        int(params["Pickup_Year"]),
        int(params["Pickup_Month"]),
        int(params["Pickup_Day"]),
    )
    today = datetime.now(ZoneInfo("Europe/Istanbul")).date()
    assert pickup > today, "Geçmiş gün için müsait araç aranmamalı."

    response = broker_api.get(
        AVAILABLE_PATH, params=params, timeout=60_000, retry_once=True
    )
    cars = xml_yaniti_goster(
        response,
        "Müsait Araçlar",
        "musait_araclar",
        "Car",
        ("Rez_ID", "Group_ID", "Car_Name", "Brand", "Type", "Total_Rental"),
    )
    first_bookable_car(cars)
    print(
        "Arama tarihleri: "
        f"{params['Pickup_Day']}.{params['Pickup_Month']}.{params['Pickup_Year']} "
        f"→ {params['Drop_Off_Day']}.{params['Drop_Off_Month']}.{params['Drop_Off_Year']}",
        flush=True,
    )
