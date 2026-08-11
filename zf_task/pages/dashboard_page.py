from pages.base_page import BasePage

class DashboardPage(BasePage):
    def __init__(self, page):
        super().__init__(page)
        
       #direk rezervasyon ikonunu buldurdum
        self.reservation_sidebar_icon = page.locator("a[href='/reservation']")

        self.uzun_donem_sidebar_icon = page.get_by_title("Uzun Dönem Kiralama")

    def click_reservation_menu(self):
       
        self.click_element(self.reservation_sidebar_icon)


    def click_uzun_donem_menu(self): 
        
        self.click_element(self.uzun_donem_sidebar_icon)
        self.page.wait_for_timeout(4000)
  
            


