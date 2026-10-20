# Kurumsal kısa dönem rezervasyonu

Bu akış mevcut sözleşmesi ve müşterisi bulunan kurumsal kısa dönem kaydını
oluşturur. Normal kısa dönemle aynı rezervasyon formu, müşteri/ehliyet ve fatura
bileşenlerini kullanır; normal akışın `Ödemeyi Sonra Al` davranışını kullanmaz.

## Kapsam

1. UI login.
2. Kurumsal Kısa Dönem listesi.
3. Ortam değişkenindeki sözleşme numarasıyla arama ve doğru tablo satırına çift tıklama.
4. Rezervasyon Yap → Devam Et.
5. Bitiş tarihi, Çankaya Next Level, CDAD ve ortam müşterisi.
6. Ehliyet eksikse ortak ehliyet modalı.
7. Kurumsal fatura tipi.
8. Tek dönemde bir; çok aylı rezervasyonda her ay için ayrı ek hizmet.
   `Ek Sürücü` hiçbir zaman seçilmez.
9. Fatura adresi eksikse ortak adres modalı.
10. Tek Kaydet ve oluşturma API yanıtının doğrulanması.
11. Ortak sözleşme dosyasının yüklenmesi. Kurumsal iş kuralı gereği provizyon adımı tamamen atlanır.
12. Teslimata yönlendirme, teslim formu ve altı araç fotoğrafı.
13. Müşteri kimliğiyle iade filtresi; teslimde okunan plakayla tek doğru satırı seçme.
14. İade KM/yakıt/hasar formu ve varsa kalan form-fotoğraf-yıkama-yakıt adımları.
15. Akış tamamlandıktan sonra logout.

Ofis ve araç grubu autocomplete alanlarına değer önce `fill` ile yazılır,
ardından tam eşleşen seçenek seçilir. Böylece ekranda görünen metnin yanında
uygulamanın ihtiyaç duyduğu gerçek kayıt ID'si de forma bağlanır.
`Ankara Çankaya (Next Level AVM)` ve `CDAD` ortam değişkeni değildir. Değerler
ortak rezervasyon formundaki `fillAndChoose()` çağrılarına doğrudan yazılmıştır.

Kayıttan dönen rezervasyon ID/kodu ortak bir yaşam döngüsü bağlamında tutulur.
İade tablosunda kod görünmediği için müşteri kimliği yalnız filtre olarak,
teslim formundan okunan plaka ise satır doğrulaması olarak kullanılır. Böylece
aynı müşterinin eski rezervasyonundaki ilk işlem düğmesine basılmaz.

## Ortam değişkenleri

Zorunlu:

```dotenv
ALLOW_WRITE_TESTS=true
VALIDATION_CORPORATE_CONTRACT_NUMBER=
VALIDATION_CORPORATE_CUSTOMER_IDENTITY=
```

Test senaryosu:

```dotenv
VALIDATION_CORPORATE_DURATION_DAYS=45
VALIDATION_CORPORATE_ADDITIONAL_SERVICE=SCDW Hizmeti
VALIDATION_CORPORATE_INVOICE_TYPE=Full credit
```

`CORPORATE_ADDITIONAL_SERVICE` boşsa `Ek Sürücü` dışındaki ilk uygun hizmet
seçilir. CI için açık bir hizmet adı tanımlamak daha kararlı sonuç verir. Süre
uygulamada birden fazla aylık periyot oluşturursa Aylık Özelleştir açılır ve her
ay sekmesinde ayrı seçim yapılır.

Varsayılan kurumsal süre 45 gündür. Böylece tek dönem yerine birden fazla aylık
dönem oluşur ve her dönem için ayrı ek hizmet seçilebilir.

Seçilen müşterinin ehliyeti ve fatura adresi sistemde kayıtlıysa yalnız sözleşme
numarası ile müşteri kimliği yeterlidir. Aşağıdaki alanları önceden `.env` dosyasına
eklemeyin; ilgili modal açılırsa testin verdiği eksik alan hatasına göre ekleyin.

| Açılan modal | Gerekli ek değişkenler (`VALIDATION_` veya `DEV_` önekiyle) |
|---|---|
| Sürücü Ekle | `CORPORATE_CUSTOMER_LICENSE_NUMBER`, `CORPORATE_CUSTOMER_LICENSE_DATE` |
| Fatura adresi | `CORPORATE_CUSTOMER_FIRST_NAME`, `CORPORATE_CUSTOMER_LAST_NAME`, `CORPORATE_CUSTOMER_EMAIL`, `CORPORATE_CUSTOMER_PHONE`, `CORPORATE_CUSTOMER_ADDRESS` |

İl ve ilçe için varsayılanlar Ankara ve Yenimahalle'dir. Müşterinin bilgileri
farklıysa `CORPORATE_CUSTOMER_PROVINCE` ve `CORPORATE_CUSTOMER_DISTRICT`
alanlarını da aynı ortam önekiyle ekleyin. Sürücü doğum ülkesi farklıysa
`CORPORATE_CUSTOMER_COUNTRY` kullanılabilir.

## Çalıştırma

```sh
TEST_ENV=validation ALLOW_WRITE_TESTS=true npm run test:corporate -- --headed
```

Test yalnızca dev ve validation host allowlist'inde çalışır. Production veya
başka bir URL verilirse yazma koruması testi başlamadan durdurur.

## Mimari

| Katman | Sorumluluk |
|---|---|
| `pages/corporate-short-term.page.js` | Sözleşme listesi ve kurumsal akışa özgü orkestrasyon |
| `components/reservations/reservation-form.js` | Ortak tarih/ofis/grup ve tek Kaydet |
| `customer-driver.section.js` | Müşteriyi kimlikle seçme ve ehliyet cevabı |
| `driver-license.modal.js` | Yalnızca ehliyet modalı |
| `billing.section.js` | Fatura tipi ve adresin var/yok kararı |
| `billing-address.modal.js` | Yalnızca adres modalı |
| `additional-services.section.js` | Tek/çok aylı hizmetler ve Ek Sürücü dışlama |
| `api/reservation.assertions.js` | UI'dan kaydedilen rezervasyonu API'den geri okuma |
| `components/reservations/rental-agreement.flow.js` | Sözleşme yükleme ve kurumsalda provizyonu atlama |
| `pages/vehicle-delivery.page.js` | Ortak araç teslim formu |
| `pages/return-list.page.js` | Kimlik + plaka ile doğru iade satırı |
| `pages/vehicle-return.page.js` | Ortak araç iade formu |
| `flows/rental-lifecycle.flow.js` | Sözleşme → teslim → iade orkestrasyonu |

Test raporu sözleşme ve müşteri kimliğini maskeler. Telefon, e-posta, ehliyet ve
adres artifact'e yazılmaz.

## GitLab

`corporate-short-term-reservation` işi başlangıçta yalnızca validation için,
protected branch üzerinde ve manuel çalışır. Protected schedule'da
`RUN_CORPORATE_SHORT_TERM=true` verilirse otomatikleşir. Dev hesabının ofis ve
yetkileri ayrıca doğrulanmadan dev yazma işi açılmamalıdır.
