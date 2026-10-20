class AracSecModal:
    def __init__(self, page):
        self.page = page

    def arac_sec(self):
        aras_secim=self.page.get_by_role("textbox", name="Araç Grubu Araç Grubu")
        aras_secim.click()
        self.page.wait_for_timeout(1000)
        self.page.get_by_role("option").first.click()
        self.page.wait_for_timeout(1000)
        self.page.get_by_role("textbox", name="Araç Araç").click()
        self.page.wait_for_timeout(1000)
        self.page.get_by_role("option").first.click() 
        self.page.wait_for_timeout(1000)
        self.page.get_by_role("combobox", name="Araç Teslim Tarihi (Manuel").click()
        self.page.wait_for_timeout(1000)
        self.page.get_by_role("gridcell").first.click()
        self.page.get_by_role("button", name="Kaydet").click()
        self.page.wait_for_timeout(6000)
