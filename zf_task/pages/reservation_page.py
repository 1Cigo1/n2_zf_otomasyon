import random
from pages.base_page import BasePage

class ReservationPage(BasePage):
    def __init__(self, page):
        super().__init__(page)
        
        self.calendar_link = page.locator("a[href='/reservation/calendar']").or_(page.get_by_role("link", name="Rezervasyon Takvimi")
        )
        self.execute_action_btn = page.locator("text='İşlemi Gerçekleştir'").first
        
        self.calendar_rows = page.locator("tr").filter(has=page.locator("td.fc-timeline-slot, div.fc-timeline-slot"))

    def go_to_calendar(self):
        self.click_element(self.calendar_link)

    def select_random_date_range_and_proceed(self):
        """Sol menüyü (Araçlar listesini) pas geçerek sadece sağdaki takvim ızgarasında sürükleme yapar."""
        self.page.wait_for_timeout(3000)
        
        calendar_area = self.page.locator(".fc").first
        box = calendar_area.bounding_box()
        
        if not box:
            raise Exception("Takvim alanı bulunamadı!")
            
        
        center_x = box['x'] + (box['width'] * 0.5)
        center_y = box['y'] + (box['height'] * 0.5)
        self.page.mouse.move(center_x, center_y)
        
       
        random_scroll_x = random.randint(1, 800)
        random_scroll_y = random.randint(1, 600)
        self.page.mouse.wheel(random_scroll_x, random_scroll_y)
        self.page.wait_for_timeout(1000) 
        
        
        start_x = box['x'] + (box['width'] * random.uniform(0.35, 0.75))
        
       
        start_y = box['y'] + (box['height'] * random.uniform(0.20, 0.80))
        
       
        drag_distance = random.randint(15, 300)
        end_x = start_x + drag_distance
        
        print(f"\nGüvenli Bölgede Sürükleniyor... (Başlangıç X: {int(start_x)}, Y: {int(start_y)})")
        
        
        self.page.mouse.move(start_x, start_y)
        self.page.mouse.down()
        self.page.wait_for_timeout(500)
        
    
        self.page.mouse.move(end_x, start_y, steps=10)
        self.page.wait_for_timeout(500)
        
        self.page.mouse.up()
        self.page.wait_for_timeout(1500)
        
        self.execute_action_btn.click(force=True)