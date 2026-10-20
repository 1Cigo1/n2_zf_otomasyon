"""API testlerinin ortak Playwright bağlantıları."""

import os

import pytest

from utils.config_reader import Config


def _safe_connection_reason(error: Exception) -> str:
    """Playwright hata metnini göstermeden ağ hatasını anlaşılır biçimde özetle."""
    message = str(error).lower()
    if "timeout" in message or "timed out" in message:
        return "süre aşıldı"
    if any(word in message for word in ("econnreset", "socket hang up", "connection reset")):
        return "bağlantı sunucu tarafından kapatıldı"
    if any(word in message for word in ("enotfound", "eai_again", "getaddrinfo")):
        return "DNS adresi çözümlenemedi"
    if "econnrefused" in message or "connection refused" in message:
        return "bağlantı reddedildi"
    if any(word in message for word in ("enetunreach", "network is unreachable")):
        return "ağa erişilemiyor"
    if any(word in message for word in ("certificate", "ssl", "tls")):
        return "sertifika veya TLS hatası"
    return "bağlantı veya Playwright hatası"


def pytest_addoption(parser):
    parser.addoption(
        "--run-broker-save",
        action="store_true",
        help="Dev broker rezervasyon kaydetme testini çalıştır.",
    )
    parser.addoption(
        "--run-broker-cancel",
        action="store_true",
        help="Son broker rezervasyonunu iptal etme testini çalıştır.",
    )


@pytest.fixture
def api_request(playwright):
    """Giriş gerektirmeyen API'ler için bağlantı."""
    assert Config.BASE_URL, "Seçilen ortamın URL'si tanımlı değil."
    request = playwright.request.new_context(
        base_url=Config.BASE_URL, ignore_https_errors=True
    )
    yield request
    request.dispose()


@pytest.fixture
def broker_api(playwright):
    """Broker isteklerine .env'deki gizli başlıkları ekler."""
    names = ("BROKER_TOKEN", "BROKER_COMPANY_ID", "BROKER_APPLICATION_ID")
    missing = [name for name in names if not os.getenv(name, "").strip()]
    if missing:
        message = "Broker ayarı eksik: " + ", ".join(missing)
        if os.getenv("CI", "").strip().lower() == "true":
            pytest.fail(message, pytrace=False)
        pytest.skip(message)
    assert Config.BASE_URL, "Seçilen ortamın URL'si tanımlı değil."

    token = os.environ["BROKER_TOKEN"].strip()
    scheme = os.getenv("BROKER_AUTH_SCHEME", "Token").strip() or "Token"
    assert not token.lower().startswith(f"{scheme.lower()} "), (
        "BROKER_TOKEN içine yalnız token değerini yazın."
    )
    headers = {
        "Authorization": f"{scheme} {token}",
        "company-id": os.environ["BROKER_COMPANY_ID"],
        "application-id": os.environ["BROKER_APPLICATION_ID"],
    }
    request = playwright.request.new_context(
        base_url=Config.BASE_URL,
        extra_http_headers=headers,
        ignore_https_errors=True,
    )

    class BrokerApi:
        def get(self, path: str, params=None, timeout=None, retry_once=False):
            return self._send("GET", path, params, timeout, retry_once)

        def post(self, path: str, params=None, timeout=None):
            return self._send("POST", path, params, timeout, retry_once=False)

        def _send(self, method: str, path: str, params, timeout, retry_once: bool):
            # Tekrar yalnız çağıran test açıkça isterse yapılır.
            attempts = 2 if method == "GET" and retry_once else 1
            for attempt in range(1, attempts + 1):
                try:
                    # POST parametreleri de Postman collection'ında URL/Params alanında.
                    return request.fetch(path, method=method, params=params, timeout=timeout)
                except Exception as error:
                    if attempt < attempts:
                        print("\nGET yanıt almadan hata verdi; bir kez daha deneniyor.", flush=True)
                        continue
                    # Ham Playwright hatası Authorization başlığını içerebilir.
                    reason = _safe_connection_reason(error)
                    raise AssertionError(
                        f"Broker {method} isteği {attempt} denemede tamamlanamadı: {reason}. "
                        "HTTP yanıtı alınamadı; bu bir durum kodu veya XML hatası değil."
                    ) from None

    yield BrokerApi()
    request.dispose()


@pytest.fixture
def broker_get(broker_api):
    """İlk GET örneklerinin kullandığı kısa çağrı."""
    return broker_api.get
