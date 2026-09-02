import re
import random
from pages.base_page import BasePage
from components.adres_modal import AdresModal
from components.ehliyet_modal import EhliyetModal
from datetime import datetime, timedelta

class EditProcessPage(BasePage):
    def __init__(self, page):
        super().__init__(page)
        
        self.customer_combobox = page.locator("label:has-text('Müşteri')").locator("..").first 

        self.license_modal = page.locator("div").filter(has_text=re.compile(r"^Sürücü\*Sürücü$")).first
        
        self.vehicle_label = page.locator("label").filter(has_text=re.compile(r"^Araç$"))
        self.vehicle_box = self.vehicle_label.locator("..").first
        
        self.invoice_address_header = page.get_by_text("Fatura Adresi Bilgileri").first
        self.name_box = page.locator("#section5").get_by_text("İsim").locator("..").first
        
        self.save_button = page.locator("button").filter(has_text=re.compile(r"^Kaydet$", re.IGNORECASE)).first
        
        self.date_combobox = page.get_by_role("combobox", name="Rezervasyon Bitiş Tarihi")
        
        self.delivery_office = page.get_by_role("textbox", name="Teslim Alma Ofisi Teslim Alma")
        self.office_option = page.get_by_role("option").first
        
        self.vehicle_group = page.get_by_role("textbox", name="Araç Grubu Araç Grubu")
        self.vehicle_group_option = page.get_by_text("CDAD")
        
        self.invoice_type = page.locator("div").filter(has_text=re.compile(r"^Fatura TipiFatura Tipi$")).first
        self.invoice_type_option = page.get_by_role("option", name="Müşteri ödemeli")

    def select_customer(self, tc_number):

        self.customer_combobox.click()
        self.page.wait_for_timeout(500)
        self.page.keyboard.type(tc_number)
        self.page.wait_for_timeout(1000)
        dropdown_option = self.page.get_by_role("option").filter(has_text=tc_number).first
        dropdown_option.click()

    
    def handle_customer_license(self):

        self.page.wait_for_timeout(1500)
    
        
        if self.license_modal.is_visible():
            license_modal = EhliyetModal(self.page)
            license_modal.ehliyet_kaydet()
        else:
            print("Customer already exists")



    def select_vehicle_manually(self):
        
        self.page.wait_for_timeout(1000)
        
        box_text = self.vehicle_box.inner_text()
        clean_text = box_text.replace("Araç", "").replace("*", "").replace("\n", "").strip()
        
        if clean_text != "":
            print("No changes made.")
        else:
            
            self.vehicle_box.click()
            self.page.wait_for_timeout(1000)
            
            first_vehicle = self.page.get_by_role("option",name="34MLJ096").first
            first_vehicle.click(force=True)
            self.page.wait_for_timeout(500)
            print("First vehicle selected.")


    
        
    def select_invoice_address(self):

        self.page.keyboard.press("End")
        self.page.wait_for_timeout(2000)
        
        self.invoice_address_header.scroll_into_view_if_needed()
        self.page.wait_for_timeout(500)

        raw_text = self.name_box.inner_text()
        clean_text = "".join(raw_text.split())
        
        if clean_text in ["İsim-", "İsim", "İsim—", "İsim–"]:
            print("⚠️ Address box is empty! Opening address modal...")
            
            edit_button = self.invoice_address_header.locator("xpath=./ancestor::div[3]").locator("button").first
            edit_button.click(force=True)
            self.page.wait_for_timeout(1000)
            add_address_button = self.page.locator("button").filter(has_text="ADRES").first
            add_address_button.click(force=True)
            self.page.wait_for_timeout(1000)
            add_new_address_button = self.page.locator("button").filter(has_text=re.compile(r"^ADRES EKLE$", re.IGNORECASE)).first
            add_new_address_button.click(force=True)
            self.page.wait_for_timeout(1000)

            print("Adding address...")
            address_modal = AdresModal(self.page)
            address_modal.formu_doldur_ve_kaydet()

        else:
            print("Address already filled")

    
 
    def save(self):
        if self.save_button.is_visible():
            self.page.wait_for_timeout(1000)
            self.save_button.click()
        else:
            print("Save button is not visible")

    def select_short_term_date(self):
        self.date_combobox.click(force=True)
        self.page.get_by_text("28").nth(4).click()
        self.page.wait_for_timeout(1000)   


    def complete_process(self, tc_number, reservation_type: str):

        if reservation_type.lower() == "Corporate".lower():
            self.select_short_term_date()
            self.delivery_office.click()
            self.office_option.click()
            self.vehicle_group.click()
            self.vehicle_group_option.click()
            self.page.wait_for_timeout(1000)
        
            
            if self.invoice_type.is_visible():
                self.invoice_type.click()
                self.invoice_type_option.click()
                self.page.wait_for_timeout(1000)
            else:
                print("Invoice type option is not visible.")

        self.select_customer(tc_number)
        self.handle_customer_license()
        self.select_vehicle_manually()
        self.select_invoice_address()
        self.save()
