

import json
from pathlib import Path
from xml.etree import ElementTree


COLLECTION_FILE = Path(__file__).parent / "data" / "broker_get.postman_collection.json"
XML_DIR = Path("reports/api_xml")


def collection_yolu(istek_adi: str) -> str:
    """Collection'dan yalnız GET yöntemini ve URL yolunu okur."""
    collection = json.loads(COLLECTION_FILE.read_text(encoding="utf-8"))
    for item in collection["item"]:
        if item["name"] == istek_adi:
            request = item["request"]
            assert request["method"] == "GET"
            return request["url"].removeprefix("{{BASE_URL}}")
    raise AssertionError(f"Collection'da {istek_adi} isteği yok.")


def xml_yaniti_goster(response, baslik: str, dosya_adi: str, kayit_etiketi: str, alanlar):
    """HTTP/XML kontrolü yapar; ilk üç kaydı gösterir, tam XML'i dosyaya yazar."""
    assert response.status == 200, f"{baslik}: HTTP {response.status}"
    root = ElementTree.fromstring(response.body())
    records = root.findall(kayit_etiketi)
    assert records, f"{baslik}: hiç {kayit_etiketi} kaydı dönmedi."

    # Postman'daki Response görünümü gibi tam XML yanıtı sakla.
    XML_DIR.mkdir(parents=True, exist_ok=True)
    ElementTree.indent(root, space="  ")
    output = XML_DIR / f"{dosya_adi}.xml"
    output.write_text(ElementTree.tostring(root, encoding="unicode"), encoding="utf-8")

    # Terminalde çok uzun yanıt yerine ilk üç kaydı göster.
    sample = ElementTree.Element(root.tag)
    for record in records[:3]:
        shown = ElementTree.SubElement(sample, kayit_etiketi)
        for field in alanlar:
            ElementTree.SubElement(shown, field).text = record.findtext(field)
    ElementTree.indent(sample, space="  ")
    print(
        f"\n{baslik}: {len(records)} kayıt\n"
        + ElementTree.tostring(sample, encoding="unicode")
        + f"\nTam XML: {output.resolve()}",
        flush=True,
    )
    return records


def test_ek_hizmetler(broker_get):
    response = broker_get(collection_yolu("Ek Hizmetler"))
    services = xml_yaniti_goster(
        response, "Ek Hizmetler", "ek_hizmetler", "MesajBilgi", ("Kod", "Desc")
    )
    for service in services:
        assert service.findtext("Kod")
        assert service.findtext("Desc")


def test_ofisler(broker_get):
    response = broker_get(collection_yolu("Ofisler"))
    offices = xml_yaniti_goster(
        response, "Ofisler", "ofisler", "Location", ("Location_ID", "Location_Name")
    )
    for office in offices:
        assert office.findtext("Location_ID")
        assert office.findtext("Location_Name")


def test_araclar(broker_get):
    response = broker_get(collection_yolu("Araçlar"))
    groups = xml_yaniti_goster(
        response, "Araçlar", "araclar", "Group", ("Group_ID", "Group_Name")
    )
    for group in groups:
        assert group.findtext("Group_ID")
        assert group.findtext("Group_Name")


def test_arac_gruplari(broker_get):
    response = broker_get(collection_yolu("Araç Grupları"))
    groups = xml_yaniti_goster(
        response, "Araç Grupları", "arac_gruplari", "Group", ("Group_ID", "Group_Name")
    )
    for group in groups:
        assert group.findtext("Group_ID")
        assert group.findtext("Group_Name")
