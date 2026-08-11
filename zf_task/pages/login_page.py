from pages.base_page import BasePage


class LoginPage(BasePage):
     def __init__(self, page):
          super().__init__(page)
          self.username_field = page.get_by_role(
               "textbox", name="E-posta adresinizi giriniz")
          self.password_field = page.get_by_role(
               "textbox", name="Parolanızı giriniz")
          self.log_button = page.get_by_role("button", name="Giriş Yap")
               

     def akilli_giris_yap(self):
          
          if self.username_field.is_visible():
            print("⚠️ Sistem login sayfasına yönlendirdi! Otomatik giriş yapılıyor...")
            
            # Config'den güvenli şifreleri çekip dolduruyoruz
            self.username_field.fill(Config.EMAIL)
            self.password_field.fill(Config.PASSWORD)
            self.page.wait_for_timeout(500)
            
            self.log_button.click(force=True)
            
            # Giriş yapıp ana sayfanın yüklenmesini bekle
            self.page.wait_for_load_state("networkidle")
            print("✅ Giriş başarılı, teste devam ediliyor!")
          else:
            print("ℹ️ Zaten içerideyiz, login atlandı.")
