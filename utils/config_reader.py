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

    # URL Yönetimi
    URLS = {
        "local": os.getenv("LOCAL_URL"),
        "dev": os.getenv("DEV_URL"),
        "validation": os.getenv("VALIDATION_URL"),
        "prod": os.getenv("PROD_URL"),
    }
    BASE_URL = URLS.get(ENVIRONMENT, URLS["dev"])

    # Dinamik E-posta Seçimi (Ortam ve Role göre matris)
    if ENVIRONMENT == "validation":
        if ACTIVE_ROLE == "long":
            EMAIL = os.getenv("LONG_VALIDATION_EMAIL")
        else:
            EMAIL = os.getenv("SHORT_VALIDATION_EMAIL")
    else: # Varsayılan olarak Dev ortamı
        if ACTIVE_ROLE == "long":
            EMAIL = os.getenv("LONG_DEV_EMAIL")
        else:
            EMAIL = os.getenv("SHORT_DEV_EMAIL")

    #Sabit Veriler
    PASSWORD = os.getenv("USER_PASSWORD")
    BROWSER = os.getenv("BROWSER", "chromium")
    
    
    # Ortamın adını (DEV veya VALIDATION) kullanarak doğru TC numarasını dinamik çeker
    E2E_CUSTOMER_IDENTITY_NO = os.getenv(f"{ENVIRONMENT.upper()}_E2E_CUSTOMER_IDENTITY_NO")
    E2E_CUSTOMER_NAME = os.getenv(f"{ENVIRONMENT.upper()}_E2E_CUSTOMER_NAME")
    E2E_VEHICLE_GROUP = os.getenv("E2E_VEHICLE_GROUP")
    
    #Dinamik Sözleşme Numarası Seçimi (Örn: SHORT_DEV_CONTRACT_NUMBER)
    E2E_CONTRACT_NUMBER = os.getenv(f"{ACTIVE_ROLE.upper()}_{ENVIRONMENT.upper()}_CONTRACT_NUMBER")

    #Yazma Yetkisi (True/False)
    E2E_ALLOW_WRITE = os.getenv("E2E_ALLOW_WRITE", "false").strip().lower() in ("1", "true", "yes")