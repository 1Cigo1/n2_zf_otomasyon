# Mono ve kısa dönem testleri

Python projesi değiştirilmeden JavaScript projesine eklendi. Python'daki `DashboardPage.mono_menu`, `MonoModal`, `EditProcessPage`, `EhliyetModal`, `AdresModal`, sözleşme, teslim ve iade akışları referans alındı. Test artık rezervasyon kaydından sonra sözleşme yükleme, sıfır provizyon, araç teslimi ve araç iadesini de aynı kayıt üzerinde tamamlar.

## Ayrı çalıştırma

Terminali `fys-playwright-js` klasöründe açın. `.env` içindeki ilgili ortamın kullanıcı bilgileri dolu olmalı.

```sh
# Mono oluşturma + aynı kişiyi özel tanımlı müşteri yapma
TEST_ENV=validation ALLOW_WRITE_TESTS=true npm run test:mono -- --headed

# Kendi müşterisini oluşturur ve sözleşme → teslim → iade akışını tamamlar
TEST_ENV=validation VALIDATION_SHORT_TERM_START_OFFSET_DAYS=0 ALLOW_WRITE_TESTS=true npm run test:short-term -- --headed

# Yalnız dev ortamındaki kısa dönem testi
TEST_ENV=dev DEV_SHORT_TERM_START_OFFSET_DAYS=0 ALLOW_WRITE_TESTS=true npm run test:short-term -- --headed

# Salt-okunur iş API'leri (login oturumu açılır)
TEST_ENV=validation npm run test:mono-api
TEST_ENV=validation npm run test:reservation-api

# Dev API kontrolleri
TEST_ENV=dev npm run test:mono-api
TEST_ENV=dev npm run test:reservation-api

# Ortamları ve test türlerini birlikte seçme
TEST_ENV=all VALIDATION_SHORT_TERM_START_OFFSET_DAYS=0 ALLOW_WRITE_TESTS=true npx playwright test --project=validation-short-term --project=dev-api
```

`npm test` yalnızca dış sisteme yazmayan yerel DOM/birim kontrollerini çalıştırır. Canlı kısa dönem akışı için `ALLOW_WRITE_TESTS=true` açıkça verilmelidir. `Kayıt oluşturan test için ALLOW_WRITE_TESTS=true gerekli` hatası, senaryo başlamadan yazma izni kontrolünde durulduğunu gösterir. İlgili komutun başına yukarıdaki gibi bu ayarı ekleyin. `TEST_ENV=all` iki ortamı da seçer; tek ortamı denemek için `dev` veya `validation` kullanın.

## Senaryo

1. UI login.
2. Sentetik kimlik, isim, telefon, e-posta ve adresle Mono oluşturulur. Tip **Bireysel Müşteri**, kaynak **Local Müşteri** seçilir.
3. Aynı kimlikle arama yapılarak kişi **Özel Tanımlı Müşteriler** listesine eklenir. Kimlik aramasının API yanıtı en fazla 60 saniye beklenir; HTTP 200 gelince tam adla tek seçenek seçilir. Arama hatası ayrıca gösterilir.
4. Rezervasyon listesi açılır, **Yeni** tıklanır.
5. Başlangıç/bitiş tarihleri ve saatler doldurulur.
6. Teslim alma ofisi **Ankara Çankaya (Next Level AVM)**, araç grubu **CDAD** seçilir. Araç plakasını uygulama kendi kurallarına göre belirler; test başka gruba/ofise geri düşmez.
7. Oluşturulan müşteri kimliğiyle seçilir. `check-driver` yanıtında ehliyet yoksa **Sürücü Ekle** modalı beklenir ve doldurulur; varsa atlanır. Yeni alanların geç gelmesi sabit uyku ile tahmin edilmez.
8. **Ödemeyi Sonra Al** işaretlenir ve **Evet** onaylanır. Gerçek ödeme tahsil edilmez; ileti izin SMS kutusuna basılmaz.
9. Fatura bölümünde isim yoksa adres modalı açılıp aynı kişinin bilgileriyle doldurulur. Mevcut adres varsa korunur; seçilen adresin kimliği müşteriyle eşleşmelidir.
10. **Kaydet** bir kez tıklanır. Oluşturma API'si 201 dönmeli ve URL yeni kayıt ID'sine geçmelidir.
11. Oluşturma API yanıtı doğrulanır. Validation ortamında kayıt ayrıca API'den geri okunur: müşteri kimliği, ofis, CDAD grubu, tarihler, `skip_payment`, sürücü ve fatura adresi kontrol edilir. Dev ortamında bu ek ayrıntı sorgusu yapılmaz.
12. **Sözleşme oluştur** ve **Sözleşme Yükle** çalışır; test dosyasının gerçekten file input'a bağlandığı doğrulanır.
13. Yalnız normal kısa dönemde **Provizyon Al** açılır, tutar `0` girilir ve **Evet** ile onaylanır.
14. **Teslimata Yönlendir** sonrasında teslim hasar notu kaydedilir, form dosyası ve altı araç fotoğrafı yüklenir, **Kiraya Yönlendir** tamamlanır.
15. İade listesinin ilk API yanıtı beklenir, ardından müşteri kimliğiyle arama yapılır ve filtreli API yanıtı da beklenir. URL'nin değişmesi tek başına tablonun hazır olduğunu göstermez. Teslim formundan okunan plakanın bulunduğu tek satırdaki form düğmesi açılır; birden fazla eşleşmede test durur.
16. Teslim KM okunur; iade KM bu değerden `30` yüksek, yakıt `2` olacak şekilde doğrudan alanlara yazılır. İade hasar notu, form/fotoğraf adımları ve varsa yıkama/yakıt sihirbazı tamamlanır.
17. Yaşam döngüsü `completed` durumuna geldikten sonra logout yapılır.

## Tarihler ve ortamlar

Tam yaşam döngüsü İstanbul takvimine göre **bugün, testin başladığı dakika → 7 gün sonrası aynı dakika** aralığını kullanır. Teslim de aynı koşuda yapıldığı için başlangıç uzaklığı `0` olmalıdır. Yarın başlayan rezervasyonu bugün teslim etmek, API'de `reservation_days_mismatch` hatasına yol açar. Müsait araç broker testinin gelecek tarih kuralı ayrıdır. Kiralama süresi pozitif tam gün olmalı; ay/yıl değişimleri hesaplanır.

```dotenv
VALIDATION_SHORT_TERM_START_OFFSET_DAYS=0
VALIDATION_SHORT_TERM_DURATION_DAYS=7
DEV_SHORT_TERM_START_OFFSET_DAYS=0
DEV_SHORT_TERM_DURATION_DAYS=7
```

Ofis ve grup `components/reservations/reservation-form.js` içindeki `selectOfficeAndGroup()` fonksiyonunda tanımlıdır. Dev ortamında aynı ofis/grup veya kullanıcı yetkisi yoksa test açıkça başarısız olur; farklı seçenek seçmez.

## Dosyaların görevleri

| Dosya | Görevi |
|---|---|
| `tests/ui/mono.spec.js` | Bağımsız Mono testi; başka teste veri hazırlama zorunluluğu yok |
| `tests/ui/short-term.spec.js` | Sıralı ve açık `test.step` çağrılarıyla uçtan uca randevu testi |
| `pages/mono.page.js` | `createPerson`, `registerSpecialCustomer` |
| `pages/short-term.page.js` | Normal kısa dönem girişini ve ortak bileşenleri birleştirir |
| `components/reservations/reservation-form.js` | Ortak tarih/ofis/grup ve tek Kaydet |
| `components/reservations/customer-driver.section.js` | Müşteri seçimi ve ehliyet kararı |
| `components/reservations/driver-license.modal.js` | Ehliyet modalı |
| `components/reservations/billing.section.js` | Fatura adresinin var/yok kararı |
| `components/reservations/billing-address.modal.js` | Adres modalı |
| `components/customer-details.modal.js` | Eski importlar için geriye uyumluluk katmanı |
| `components/form.controls.js` | Etiketle alan bulma ve tam metinle dropdown seçimi; yıkama kodunu değiştirmez |
| `components/reservations/rental-agreement.flow.js` | Ortak sözleşme yükleme, opsiyonel provizyon ve teslimata yönlendirme |
| `pages/vehicle-delivery.page.js` | Teslim hasarı, form belgesi, plaka ve altı fotoğraf |
| `pages/return-list.page.js` | Kimlik filtresi + plaka ile doğru iade satırını açma |
| `pages/vehicle-return.page.js` | İade KM/yakıt, hasar ve tamamlanma sihirbazı |
| `flows/rental-lifecycle.flow.js` | Normal ve kurumsal akışın ortak yaşam döngüsü sırası |
| `support/rental-lifecycle-data.js` | Kayıt kimliği, aşamalar ve maskeli CI eki |
| `support/short-term-data.js` | Sentetik müşteri ve İstanbul tarihleri |
| `api/reservation.client.js` | Mono/özel müşteri/rezervasyon listeleri ve kaydın geri okunması |
| `tests/api/mono-and-reservation.spec.js` | 4 ayrı API testi |
| `tests/local/customer-branches.test.js` | Ehliyet var/yok, mevcut fatura adresi ve iç içe etiket regresyonları |
| `tests/local/short-term.test.js` | Tarih, sentetik veri ve parantezli ofis eşleme testleri |
| `tests/local/mono-customer.test.js` | Kimlikle müşteri arama, seçim ve arama API hatası |
| `tests/local/vehicle-lifecycle.test.js` | Teslim/iade formları, geciken liste araması ve aynı plakalı satırlar |

## API kapsamı

- Oturumsuz `GET /api/customer/`: 401/403.
- Oturumlu `GET /api/customer/`: liste/pagination ve müşteri alanları.
- Oturumlu `GET /api/customer-partner/extra/`: özel müşteri alanları.
- Oturumsuz `GET /api/short-term-rental/`: 401/403.
- Oturumlu `GET /api/short-term-rental/`: rezervasyon alanları ve sayfalama.
- Validation UI testinde `GET /api/short-term-rental/{id}/`: **o testin oluşturduğu kaydın değerleri**.

Bu servislerde cookie ve `application-id` yanında **company-id** gerekir. API istemcisi şirketi `/api/auth/me` yanıtındaki `user.selected_company.id` alanından alır. Şirket yoksa boş listeyle sahte başarı yerine hata verir. Liste testleri kayıt sayısını sabitlemez; boş test ortamında liste boş olabilir. Değer bazlı kayıt doğrulaması kısa dönem UI+API senaryosundadır. Ayrı API testleri POST ile yeni müşteri/rezervasyon oluşturmaz, mevcut kayıtları değiştirmez.

## GitLab CI

Her iş validation/dev matrisiyle ayrı çalışır:

- `mono-api`: otomatik, `@mono-api`.
- `reservation-api`: otomatik, `@reservation-api`.
- `mono-customer`: varsayılan manuel; `RUN_MONO=true` ile otomatik.
- `short-term-reservation`: varsayılan manuel; `RUN_SHORT_TERM=true` ile otomatik.
- Önceki `login-and-api` işi yeni API etiketlerini dışlar; aynı test iki işte tekrar çalışmaz.

Testler birbirinin çıktısına bağımlı değildir. `short-term` kendi müşterisini oluşturur; `mono` işinin önce çalışması gerekmez. Aynı ortamın işleri mevcut `resource_group` ile sıraya alınır. Başarısız testler otomatik tekrarlanmaz. Varsayılan manuel işler isteğe bağlıdır; otomatik moda alınan işlerin hatası pipeline'ı başarısız yapar.

Yerelde JUnit ve HTML raporları üretilir. CI'da form değerlerinde parola sızıntısı riskini önlemek için HTML raporu arşivlenmez; JUnit ve hata dosyaları tutulur. `kisa-donem-kaydi` ekinde rezervasyon ID/kodu, maskeli müşteri kimliği, plaka ve son yaşam döngüsü aşaması bulunur. Testler başarısız kaydı körlemesine silmez veya başka bir kaydın iadesini tamamlamaz.

GitLab'a push veya runner üzerinde pipeline çalıştırma bu geliştirmede yapılmadı.

## Doğrulama — 19 Ekim 2026

- İlk hata, `ALLOW_WRITE_TESTS=true` verilmediği için senaryo başlamadan oluştu. Yukarıdaki dev komutu yazma iznini ve bugün başlayan tarihi birlikte ayarlar.
- Yarın başlayan rezervasyonun bugün teslimi API'de reddedildi. Tam yaşam döngüsü bugün başlar; teslim ön kontrolü reddederse sunucunun mesajı gösterilir.
- Özel müşteri seçiminde yalnız seçeneği beklemek yerine aynı kimliğin arama API yanıtı beklenir.
- İade aramasında URL değiştiği halde eski tablo görünüyordu. İlk liste yanıtı ile arama sonrası liste yanıtı ayrı ayrı beklenir; aynı plakalı belirsiz kayda tıklanmaz.
- İlgili 17 yerel kontrol geçti. İki ortamda 35 canlı test keşfedildi; GitLab YAML ayrıştırması doğrulandı.
- Dev kaydı `ZF29500D8ES` için müşteri ve rezervasyon oluşturma, sözleşme, sıfır provizyon, teslim ve iade tamamlandı. Son aşama `completed`; iade KM teslim KM'den 30 yüksek.
- Canlı doğrulama, hata noktalarından aynı müşteri ve rezervasyonla devam edilerek yapıldı. Düzeltmelerin tamamıyla yeni müşteri oluşturan kesintisiz bir koşu henüz doğrulanmadı. GitLab runner üzerinde çalıştırılmadı.
- Bu kontrollerde gerçek `.env` dosyası değiştirilmedi.

## Önceki ortam gereksinimi: dev hesabının ofisi (21 Eylül)

21 Eylül 2026 kontrolünde dev rezervasyon listesi `400 — Kullanıcının ofisi tanımlı değil.` yanıtını verdi. Aynı hesabın Mono API kontrolleri geçti. Dev rezervasyon işi için kullanıcıya uygun ofis tanımlanmalı veya `DEV_EMAIL` / `DEV_PASSWORD` alanlarına ofisi tanımlı test hesabı verilmeli. Test bu hatayı başarı saymaz veya otomatik atlamaz. Hesap/ofis yetkileri bu geliştirmede değiştirilmedi.

## Doğrulama — 21 Eylül 2026

- Validation bağımsız Mono UI testi geçti.
- Validation kısa dönem UI + kaydı API'den geri okuma testi son koşuda geçti (39,8 saniye). Kayıt: `ZF09C58D8ES`, ID `1831caad-66ef-40b2-9034-c56122b8bb5c`; 22.09.2026 10:00 → 29.09.2026 10:00.
- Validation yeni API testleri 4/4 geçti. Dev yeni API testleri 3/4 geçti; kalan test yukarıdaki ofis eksikliği nedeniyle başarısız.
- Yerel testler 11/11 geçti. Bunlara ehliyet var/yok, mevcut fatura adresini koruma, tarih geçişleri ve eski yıkama regresyonları dahil.
- İki ortam için toplam 22 canlı test keşfedildi; GitLab YAML ayrıştırması ve yeni JS dosyalarının sözdizimi kontrolleri geçti.
- Canlı inceleme sırasında ayrıca `ZF18C20F9DS` rezervasyonu kaydedildi. Denemelerde oluşturulan sentetik Mono kayıtları ve bu iki rezervasyon silinmedi/iptal edilmedi. Dev UI kayıt oluşturma akışı çalıştırılmadı.
- Login'deki API yanıt beklemesi de `LOGIN_TIMEOUT_MS` ayarına bağlandı; yalnızca yönlendirme değil login POST yanıtı da bu üst sınırı kullanır.
