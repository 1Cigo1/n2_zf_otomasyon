import os
import pytest
from playwright.sync_api import sync_playwright
from utils.config_reader import Config

#!!!! öenmli test başlamadan sayfayı açan testler bittikten sonra kapatan ayar dosyası

@pytest.fixture(scope="session")  #bir kere bu kurulum çalışır
def browser_context():
    with sync_playwright() as p:
        user_data_dir = os.path.join(os.getcwd(), "user_data")
        browser_type = getattr(p, Config.BROWSER.lower())
        
        
        context = browser_type.launch_persistent_context(
            user_data_dir=user_data_dir,
            headless=False,
            args=["--disable-blink-features=AutomationControlled"], 
            
        )
        
        yield context  #testlere gönderir
        context.close()

@pytest.fixture(scope="function")
def clean_page(browser_context):
    pages = browser_context.pages
    page = pages[0] if pages else browser_context.new_page()
    yield page