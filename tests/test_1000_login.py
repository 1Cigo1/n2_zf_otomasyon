from utils.config_reader import Config
from playwright.sync_api import expect

def test_login_with_pause(clean_page):
  
    # gerçek domaine gittimmm
    clean_page.goto(Config.BASE_URL)
    
    
    
    
    expect(clean_page).to_have_url(f"{Config.BASE_URL}", timeout=15000)