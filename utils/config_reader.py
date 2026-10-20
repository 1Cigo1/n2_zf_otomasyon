import os
from pathlib import Path
from dotenv import load_dotenv

# .env dosyasını güvenle yükle
load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)


class Config:
    # Ortam ve Rolü belirle (Eğer "test" girilirse bunu "dev" olarak kabul et)
    _raw_env = os.getenv("TEST_ENV", "dev").strip().lower()
    ENVIRONMENT = "dev" if _raw_env == "test" else _raw_env
    ACTIVE_ROLE = os.getenv("ACTIVE_ROLE", "short").strip().lower()
    if ACTIVE_ROLE not in {"short", "long"}:
        raise ValueError(
            f"Desteklenmeyen ACTIVE_ROLE: {ACTIVE_ROLE}. Beklenen: short veya long"
        )

    # URL Yönetimi
    URLS = {
        "local": os.getenv("LOCAL_URL"),
        "dev": os.getenv("DEV_URL"),
        "validation": os.getenv("VALIDATION_URL"),
        "prod": os.getenv("PROD_URL"),
    }
    if ENVIRONMENT not in URLS:
        raise ValueError(
            f"Desteklenmeyen TEST_ENV: {ENVIRONMENT}. "
            f"Beklenen değerlerden biri: {', '.join(URLS)}"
        )
    BASE_URL = URLS[ENVIRONMENT]

    # Dinamik E-posta Seçimi (Ortam ve Role göre matris)
    if ENVIRONMENT == "validation":
        if ACTIVE_ROLE == "long":
            EMAIL = os.getenv("LONG_VALIDATION_EMAIL")
            PASSWORD = os.getenv("VALIDATION_USER_PASSWORD") or os.getenv(
                "validation_USER_PASSWORD"
            )
        else:
            EMAIL = os.getenv("SHORT_VALIDATION_EMAIL")
            PASSWORD = os.getenv("VALIDATION_USER_PASSWORD") or os.getenv(
                "validation_USER_PASSWORD"
            )
    elif ENVIRONMENT in {"local", "dev"}:
        if ACTIVE_ROLE == "long":
            EMAIL = os.getenv("LONG_DEV_EMAIL")
            PASSWORD = os.getenv("DEV_USER_PASSWORD") or os.getenv("USER_PASSWORD")
        else:
            EMAIL = os.getenv("SHORT_DEV_EMAIL")
            PASSWORD = os.getenv("DEV_USER_PASSWORD") or os.getenv("USER_PASSWORD")
    else:  # prod yalnızca açıkça tanımlanmış, salt-okunur kontroller içindir.
        EMAIL = os.getenv("PROD_EMAIL")
        PASSWORD = os.getenv("PROD_USER_PASSWORD")

    BROWSER = os.getenv("BROWSER", "chromium")

    # Ortamın adını (DEV veya VALIDATION) kullanarak doğru TC numarasını dinamik çeker
    E2E_CUSTOMER_IDENTITY_NO = os.getenv(
        f"{ENVIRONMENT.upper()}_E2E_CUSTOMER_IDENTITY_NO"
    )
    MONTHLY_CUSTOMER_IDENTITY_NO = os.getenv(
        f"{ENVIRONMENT.upper()}_MONTHLY_CUSTOMER_IDENTITY_NO"
    )
    E2E_CUSTOMER_NAME = os.getenv(f"{ENVIRONMENT.upper()}_E2E_CUSTOMER_NAME")
    E2E_VEHICLE_GROUP = os.getenv("E2E_VEHICLE_GROUP")

    # Dinamik Sözleşme Numarası Seçimi (Örn: SHORT_DEV_CONTRACT_NUMBER)
    E2E_CONTRACT_NUMBER = os.getenv(
        f"{ACTIVE_ROLE.upper()}_{ENVIRONMENT.upper()}_CONTRACT_NUMBER"
    )

    # Yazma Yetkisi (True/False)
    E2E_ALLOW_WRITE = os.getenv("E2E_ALLOW_WRITE", "false").strip().lower() in (
        "1",
        "true",
        "yes",
    )
    if ENVIRONMENT == "prod" and E2E_ALLOW_WRITE:
        raise RuntimeError("Prod ortamında E2E_ALLOW_WRITE=true kullanılamaz.")

    @classmethod
    def validate_login(cls):
        missing = []
        if not cls.BASE_URL:
            missing.append(f"{cls.ENVIRONMENT.upper()}_URL")
        if not cls.EMAIL:
            missing.append("ortama ve role uygun e-posta")
        if not cls.PASSWORD:
            missing.append("ortama uygun parola")
        if missing:
            raise RuntimeError(
                "Giriş yapılandırması eksik: " + ", ".join(missing)
            )
