from pages.base_page import BasePage
from utils.config_reader import Config

class LoginPage(BasePage):
     def __init__(self, page):
          super().__init__(page)
          self.email_input = page.get_by_role("textbox", name="E-posta adresinizi giriniz")
          self.password_input = page.get_by_role("textbox", name="Parolanızı giriniz")
          self.login_button = page.get_by_role("button", name="Giriş Yap")
          
     def akilli_giris_yap (self):
          
          self.page.wait_for_load_state("domcontentloaded")
          self.page.wait_for_timeout(1000) 
          
          mevcut_url = self.page.url
          

          
          if "login" in mevcut_url.lower():
               
               self.email_input.wait_for(state="visible", timeout=10000)
               
               # Formu doldur
               self.email_input.fill(Config.EMAIL)
               self.password_input.fill(Config.PASSWORD)
               self.page.wait_for_timeout(500)
               
               self.login_button.click(force=True)
               
               # Giriş yaptıktan sonra sayfanın durulmasını bekle
               self.page.wait_for_load_state("networkidle")
               print(" Giriş başarılı")
          else:
               print("login atlandı.")