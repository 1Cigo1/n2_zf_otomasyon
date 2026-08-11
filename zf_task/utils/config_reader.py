import os
from dotenv import load_dotenv

# .env dosyasındaki değişkenleri projeye dahil eder
load_dotenv(override=True)

class Config:
    # 1. TEST_ENV değişkenini .env'den oku
    ENVIRONMENT = os.getenv("TEST_ENV", "test").strip().lower()

    # 2. Tüm ortam URL'lerini .env dosyasından çek
    URLS = {
        "local": os.getenv("LOCAL_URL"),
        "test": os.getenv("TEST_URL"),
        "dev": os.getenv("DEV_URL", os.getenv("TEST_URL")),
        "prod": os.getenv("PROD_URL"),
    }

    # 3. Seçilen ortama göre aktif BASE_URL'i belirle
    BASE_URL = URLS.get(ENVIRONMENT, URLS["test"])

    EMAIL = os.getenv("USER_EMAIL")
    PASSWORD = os.getenv("USER_PASSWORD")

    BROWSER = os.getenv("BROWSER", "chromium")

    E2E_CUSTOMER_IDENTITY_NO = os.getenv("E2E_CUSTOMER_IDENTITY_NO")
    E2E_ALLOW_WRITE = os.getenv("E2E_ALLOW_WRITE", "false").strip().lower() in ("1", "true", "yes")