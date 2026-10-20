# FYS Python ve JavaScript test otomasyonu

Bu repo, mevcut Python projesi ile ayrı kurulan JavaScript projesini birlikte içerir.

| Proje | Konum | Başlangıç |
|---|---|---|
| Python / pytest / Playwright | Repo kökü | Aşağıdaki kurulum adımları |
| JavaScript / Playwright | `fys-playwright-js/` | [JavaScript başlangıç rehberi](fys-playwright-js/docs/START_HERE.md) |

Python komutlarını repo kökünde, JavaScript komutlarını `fys-playwright-js/`
klasöründe çalıştırın. Her proje kendi bağımlılıklarını ve kendi `.env` dosyasını
kullanır. Gerçek `.env`, tarayıcı oturumları ve test çıktıları Git'e eklenmez.

Kökteki `.gitlab-ci.yml` Python işleri içindir; JavaScript projesinin kendi GitLab
yapılandırması alt klasördedir. GitHub üzerinde otomatik test çalıştırmak için
ayrıca GitHub Actions iş akışı gerekir; bu repoda henüz tanımlı değildir.

## Python projesi

FYS uygulamasının Python, pytest ve Playwright ile yazılmış testleri. Page Object
Model (POM) yapısında sayfalar `pages/`, ortak modallar `components/`, senaryolar
`tests/` altında bulunur. JavaScript projesinden bağımsız kurulur ve çalışır.

## Kurulum

Komutları repo kökünde (`n2_zf_otomasyon`) çalıştırın. Örnekler macOS/Linux terminali içindir.
Proje yerelde Python 3.14 ile doğrulandı.

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m playwright install chromium
```

Linux runner üzerinde sistem bağımlılıkları da gerekiyorsa
`python -m playwright install --with-deps chromium` kullanın. GitLab işi
tarayıcıların hazır olduğu Playwright Docker imajını kullanır.

Bağımlılıklar `requirements.txt` içinde sabittir: Playwright `1.62.0`, pytest
`9.1.1`, pytest-html `4.2.0` ve python-dotenv `1.2.2`. CI imajındaki Playwright
sürümü de `1.62.0`'dır.

## Ortam ayarları

Proje kökünde `.env` oluşturun; varsa mevcut dosyanızı düzenleyin. Bu projede
`.env.example` yoktur. Aşağıdaki boş alanlara kendi test bilgilerinizi girin.
`.env` Git tarafından yok sayılır.

```dotenv
TEST_ENV=dev
ACTIVE_ROLE=short
BROWSER=chromium
HEADLESS=false
E2E_ALLOW_WRITE=false

DEV_URL=https://dev-fys.n2mobil.co/
VALIDATION_URL=https://fys-validation.n2mobil.co/
SHORT_DEV_EMAIL=
LONG_DEV_EMAIL=
DEV_USER_PASSWORD=
SHORT_VALIDATION_EMAIL=
LONG_VALIDATION_EMAIL=
VALIDATION_USER_PASSWORD=

DEV_E2E_CUSTOMER_IDENTITY_NO=
DEV_MONTHLY_CUSTOMER_IDENTITY_NO=
DEV_E2E_CUSTOMER_NAME=
VALIDATION_E2E_CUSTOMER_IDENTITY_NO=
VALIDATION_MONTHLY_CUSTOMER_IDENTITY_NO=
VALIDATION_E2E_CUSTOMER_NAME=
SHORT_DEV_CONTRACT_NUMBER=
SHORT_VALIDATION_CONTRACT_NUMBER=
E2E_VEHICLE_GROUP=CDAD

# Broker testleri için (değerleri yalnız kendi .env dosyanıza yazın):
BROKER_TOKEN=
BROKER_COMPANY_ID=
BROKER_APPLICATION_ID=
# Varsayılan yetkilendirme öneki:
BROKER_AUTH_SCHEME=Token
# Müsait araç araması (isteğe bağlı):
BROKER_DAYS_AHEAD=7
BROKER_RENTAL_DAYS=2
BROKER_CURRENCY=TRY
BROKER_HOUR=10
# Yalnız rezervasyon kaydı için test müşterisi:
BROKER_TEST_RENTAL_ID=
BROKER_GENERATE_RENTAL_ID=true
BROKER_TEST_NAME=
BROKER_TEST_SURNAME=
BROKER_TEST_MOBILE_PHONE=
BROKER_TEST_EMAIL=
```

| Ayar | Kullanımı |
|---|---|
| `TEST_ENV` | Yerelde varsayılan `dev`, GitLab'da `validation`; `test` değeri `dev` kabul edilir |
| `ACTIVE_ROLE` | Kısa dönem/FAYT için `short`, uzun dönem hesabı için `long` |
| `HEADLESS` | `true`: tarayıcı penceresi açılmaz; yerelde varsayılan `false` |
| `E2E_ALLOW_WRITE` | Kayıt oluşturan E2E testlerini çalıştırmak için `true` |
| `*_E2E_CUSTOMER_IDENTITY_NO` | Kurumsal rezervasyonda seçilecek müşteri |
| `*_MONTHLY_CUSTOMER_IDENTITY_NO` | Aylık rezervasyonda seçilecek müşteri ve sürücü |
| `SHORT_*_CONTRACT_NUMBER` | Kurumsal kısa dönem listesindeki sözleşme numarası |
| `*_E2E_CUSTOMER_NAME`, `E2E_VEHICLE_GROUP` | Uzun dönem akışının müşteri ve araç grubu verileri |

`utils/config_reader.py` ortam ve role göre bilgileri seçer. Terminal/GitLab
değişkenleri `.env` değerlerinden önceliklidir. Eski `USER_PASSWORD` ve
`validation_USER_PASSWORD` adları da desteklenir. Geçersiz ortam/rol hata verir;
`prod` ortamında yazma izni açılamaz.

## Testleri çalıştırma

Sanal ortam aktifken proje kökünden çalıştırın:

```sh
# Senaryoları çalıştırmadan listele.
python -m pytest --collect-only -q

# Yerel HTML ve mock kullanan mevcut kontroller (Chromium gerekir).
python -m pytest -q tests/unit

# Dev ortamındaki salt-okunur API kontrolleri (tarayıcı açılmaz).
TEST_ENV=dev ACTIVE_ROLE=short python -m pytest -s tests/api

# Validation login, pencere açılmadan.
TEST_ENV=validation HEADLESS=true python -m pytest -q tests/test_1000_login.py

# CI gibi kişisel tarayıcı profilini kullanmadan giriş yap.
CI=true TEST_ENV=validation HEADLESS=true E2E_ALLOW_WRITE=false python -m pytest -q tests/test_1000_login.py
```

Aşağıdaki komutlar test ortamında gerçek kayıt oluşturur veya değiştirir:

```sh
# Normal kısa dönem: Mono → rezervasyon → sözleşme → teslim → iade.
TEST_ENV=dev ACTIVE_ROLE=short E2E_ALLOW_WRITE=true python -m pytest -s tests/test_02_reservation.py

# Kurumsal kısa dönem: belirtilen sözleşme ve müşteriyle rezervasyon.
TEST_ENV=dev ACTIVE_ROLE=short E2E_ALLOW_WRITE=true python -m pytest -s tests/test_04_corporate.py

# Aylık rezervasyon: .env içindeki DEV_MONTHLY_CUSTOMER_IDENTITY_NO kullanılır.
TEST_ENV=dev ACTIVE_ROLE=short E2E_ALLOW_WRITE=true python -m pytest -s tests/test_08_monthly_reservation.py

# Uzun dönem hesabıyla sözleşme ve araç işlemleri.
TEST_ENV=dev ACTIVE_ROLE=long E2E_ALLOW_WRITE=true python -m pytest -s tests/test_03_long_term_rental.py

# Araç bakım, standart yıkama veya kiralama dönüşü yakıt alma.
TEST_ENV=dev E2E_ALLOW_WRITE=true python -m pytest -s tests/test_05_Fayt.py
TEST_ENV=validation ACTIVE_ROLE=short E2E_ALLOW_WRITE=true python -m pytest -s tests/test_06_Standart_Yikama.py
TEST_ENV=validation ACTIVE_ROLE=short E2E_ALLOW_WRITE=true python -m pytest -s tests/test_07_Kiralama_Donusu_Yakit.py
```

Herhangi bir komuta `HEADLESS=true` ekleyerek pencere açmadan çalıştırabilirsiniz.
`-s`, `print` çıktılarının terminalde görünmesini sağlar. Yazma izni kapalıysa
ilgili testler `skipped` görünür; nedenini `-rs` ile okuyun.

`pytest.ini` her yerel pytest çalışmasında otomatik olarak
`reports/html/local-latest.html` raporunu üretir. Bu yüzden rapor için komuta
`--html` veya `--self-contained-html` eklemek gerekmez. Yeni koşu bu yerel raporun
üzerine yazar; GitLab işleri ise kendilerine ait isimli HTML raporlarını artifact
olarak saklar.

Chromium işlemi bir pytest koşusunda bir kez başlatılır, fakat her test için yeni
bir browser context ve sayfa oluşturulur. Bu nedenle testler cookie, localStorage,
cache veya kullanıcı oturumu paylaşmaz; her test kendi ortam ve rol bilgileriyle
yeniden giriş yapar. Dosya yükleme yolları için komutları proje kökünden başlatın.

## Dosyaların görevleri

| Yol | Görevi |
|---|---|
| `tests/conftest.py` | Tarayıcı/sekme kurulumu, kapatma ve yazma izni kontrolü |
| `tests/test_*.py` | Sayfa ve modal metotlarını sıralayan senaryolar |
| `tests/unit/` | Ek hizmetler ve FAYT davranışlarının yerel kontrolleri |
| `tests/api/test_basit_get.py` | Collection kullanmadan yazılmış temel Tema GET örneği |
| `tests/api/test_collection_get.py` | Güvenli collection kopyasındaki dört parametresiz broker GET testi |
| `tests/api/test_musait_araclar.py` | Gelecek tarihler için müsait araç GET ve XML çıktısı |
| `tests/api/test_rezervasyon_kaydet.py` | GET'teki araç kimliği ve tarihlerle ayrı POST kayıt testi |
| `tests/api/test_rezervasyon_iptal.py` | Son kaydın `Rez_ID` değeriyle ayrı iptal testi |
| `tests/api/booking_data.py` | Üç adımın ortak tarih, parametre ve XML yardımcıları |
| `pages/login_page.py` | Mevcut oturumu kontrol eder; gerekiyorsa giriş yapar |
| `pages/dashboard_page.py` | Menü geçişleri, Mono ve iade listesine erişim |
| `pages/edit_process_page.py` | Rezervasyon alanları, ehliyet/fatura, sözleşme ve provizyon |
| `pages/Vehicle_condition.py` | Araç teslim ve iade formları |
| `pages/fayt_pages.py` | Workflow açma, aynı araç talebini bulma ve ilerletme |
| `components/` | Ehliyet, adres, tarih, ek hizmet, yükleme ve FAYT modalları |
| `utils/config_reader.py` | Ortama ve role göre ayarlar |
| `test_data/` | Yüklenen örnek belge ve araç fotoğrafları |

Test senaryosu ne yapılacağını, page sınıfı sayfadaki işlemi, component ise
tekrar kullanılan formu yönetir. Normal ve kurumsal rezervasyon aynı
`EditProcessPage`, ehliyet/adres modalları ve teslim/iade sayfasını kullanır.
Aylık test de `islemleri_tamamla(..., reservation_type="Monthly")` çağırır.
Bu dal SKODA → SUPERB → listedeki rastgele aracı seçer, 30 günlük iki dönem
oluşturur ve Ek Sürücü dışındaki bir ek hizmeti tüm dönemlere uygular.
Ek hizmetlerde aylık dönemler varsa her ay için seçim yapılır; Ek Sürücü dışlanır.

## GitLab CI/CD

Depo kökü bu klasör olmalıdır; `.gitlab-ci.yml` GitLab'ın gördüğü kökte bulunur.
Settings → CI/CD → Variables altında ortamın URL, e-posta, parola ve senaryoya
özgü müşteri/sözleşme değişkenlerini tanımlayın. Parolaları masked kaydedin.
Protected değişkenler yalnız uygun protected dallardaki işlere verilir.

| İş | Ne zaman / ne çalışır? |
|---|---|
| `python_syntax` | Python dosyalarının sözdizimini kontrol eder |
| `unit_tests` | Mevcut yerel kontrolleri çalıştırır |
| `login_smoke` | Ana dalda ve schedule'da otomatik; diğer durumlarda manuel |
| `api_smoke_dev` | Dev API için manuel; Tema, collection GET ve müsait araç GET testleri |
| `api_booking_save_dev` | Manuel; dev ortamında rezervasyon kaydeder |
| `api_booking_cancel_dev` | Manuel; aynı pipeline'daki kayıt işinin Rez_ID değeriyle iptal gönderir |
| `short_term_tests` | Dev/short; normal ve kurumsal kısa dönem testleri |
| `monthly_reservation_tests` | Dev/short; aylık rezervasyon testi |
| `long_term_tests` | Dev/long; uzun dönem testi |
| `vehicle_washing_tests` | Validation/short; standart araç yıkama testi |
| `rental_return_fuel_tests` | Validation/short; kiralama dönüşü yakıt alma testi |

Pipeline varsayılanı `HEADLESS=true` olduğu için tarayıcı penceresi açılmaz.
E2E işleri doğru ortamı ve rolü kendi içinde seçer. İşleri ayrı ayrı Play düğmesiyle
başlatabilir veya **Run pipeline** ekranında `RUN_E2E=true` vererek hepsini
çalıştırabilirsiniz. Aynı dev ortamını kullanan kısa ve uzun dönem işleri sıraya girer.
Validation araç yıkama ve yakıt alma işleri de aynı test araçlarını korumak için
birbirini bekler.

API işleri `RUN_E2E=true` ile başlamaz. GitLab **Settings → CI/CD → Variables**
altında `DEV_URL`, `BROKER_TOKEN`, `BROKER_COMPANY_ID` ve
`BROKER_APPLICATION_ID` tanımlı olmalıdır; eksikler API işinde hata verir.
Kaydetme işi için ayrıca `BROKER_TEST_NAME`, `BROKER_TEST_SURNAME`,
`BROKER_TEST_MOBILE_PHONE`, `BROKER_TEST_EMAIL` ve
`BROKER_GENERATE_RENTAL_ID=true` gerekir. Sabit test kimliği kullanılıyorsa
bunun yerine `BROKER_TEST_RENTAL_ID` tanımlanabilir. Bunları `.gitlab-ci.yml` içine
değerleriyle yazmayın. İsteğe bağlı gün/ofis/saat ayarları yereldeki aynı
`BROKER_*` adlarıyla GitLab değişkeni olarak verilebilir.

Önce `api_smoke_dev` işini Play ile çalıştırın; tam GET XML'leri işin
artifact'larında `reports/api_xml/` altında görünür. Rezervasyon oluşturmak
istiyorsanız `api_booking_save_dev` işini ayrıca Play ile çalıştırın.
Kaydı inceleyip iptal etmek istediğinizde **aynı pipeline'daki**
`api_booking_cancel_dev` işini Play ile çalıştırın. İptal otomatik yapılmaz.
Kayıt ve iptal yanıt XML'leri ile varsa hata XML/TXT dosyaları da ilgili işin
artifact'larında görünür. API yanıtları dev test verisiyle sınırlı tutulmalıdır.
İşler arası aktarılan dosyada yalnız `Rez_ID`, ortam ve kayıt durumu bulunur;
token ve müşteri alanları bulunmaz. Bu dosya, kayıt işinin artifact süresi
dolmadan kullanılmalıdır (şu an 7 gün). Manuel işlerin sonucu için yalnız
pipeline genel durumuna değil, ilgili işin `PASSED`/`FAILED` sonucuna bakın.

Runner Docker çalıştırabilmeli ve hedef ortama erişebilmelidir. Pipeline
uygulamayı dağıtmaz; CI/CD içinde test aşaması sağlar.
[Ayrıntılı CI/CD rehberi](docs/CI_CD.md).

## Raporlar ve sorun giderme

```sh
CI=true TEST_ENV=validation HEADLESS=true E2E_ALLOW_WRITE=false python -m pytest -q tests/test_1000_login.py --junitxml=test-results/junit.xml
```

GitLab JUnit sonucunu Tests bölümünde gösterir. Her iş ayrıca `reports/html/`
altında HTML raporu üretir. Başarısız bir UI testinde ekran görüntüsü otomatik
olarak `test-results/screenshots/` altına kaydedilir ve HTML raporuna eklenir.
GitLab bu artifact dosyalarını 7 gün saklar.

## API testleri

Önce iki küçük GET örneği var:

1. `tests/api/test_basit_get.py`: Collection okumadan Tema API'sine GET gönderir.
   Yanıt JSON olduğu için `response.json()` kullanır.
2. `tests/api/test_collection_get.py`: Token ve müşteri verisi içermeyen
   `tests/api/data/broker_get.postman_collection.json` dosyasından dört isteğin
   yalnız adını, `GET` yöntemini ve yolunu alır. Yanıtlar XML'dir.

Collection'daki bu dört istekte URL parametresi yoktur:

| İstek | XML kaydı | Görünen alanlar |
|---|---|---|
| Ek Hizmetler | `MesajBilgi` | `Kod`, `Desc` |
| Ofisler | `Location` | `Location_ID`, `Location_Name` |
| Araçlar | `Group` | `Group_ID`, `Group_Name` |
| Araç Grupları | `Group` | `Group_ID`, `Group_Name` |

Proje klasöründe çalıştırın:

```sh
TEST_ENV=dev python3 -m pytest -s tests/api
```

`-s` ile terminalde her yanıtın ilk üç kaydı okunabilir XML olarak görünür.
**Tam XML** yanıtları `reports/api_xml/` klasörüne ayrı dosyalar olarak yazılır.
Bu klasör Git tarafından yok sayılır. Örneğin
`reports/api_xml/ofisler.xml` dosyasını editörde açıp bütün ofisleri ve alanları
Postman Response görünümündeki gibi inceleyebilirsiniz. Tema örneği JSON
olduğu için XML'e dönüştürülmez.

Broker testlerinin `Authorization`, `company-id` ve `application-id` başlıkları
`.env` içindeki `BROKER_TOKEN`, `BROKER_COMPANY_ID` ve
`BROKER_APPLICATION_ID` değerlerinden kurulur. Token ekrana veya XML dosyasına
yazılmaz. Asıl Postman export dosyasındaki token ve örnek müşteri değerleri
bu testlerde okunmaz; dört parametresiz GET testi yalnız güvenli GET kopyasını
kullanır.

### Müsait araç → rezervasyon kaydet → iptal

Bu üç test ayrı dosyalardadır. Varsayılan arama tarihi Türkiye saatine göre
**bugünden 7 gün sonrası**, dönüş tarihi alıştan **2 gün sonrası**dır. Gün
sayılarını `.env` içinde `BROKER_DAYS_AHEAD=7` ve `BROKER_RENTAL_DAYS=2` ile
değiştirebilirsiniz; ikisi de pozitif sayı olmalıdır. İsterseniz
`BROKER_PICKUP_ID` ve `BROKER_DROP_OFF_ID` ile ofisleri değiştirebilirsiniz.
Para birimi `BROKER_CURRENCY` (`TRY`, `EUR`, `USD`, `GBP`), saat ise
`BROKER_HOUR` (0–23) ile değişir. Aynı değerler kayıt isteğine aktarılır.

1. **Yalnız listele:** `tests/api/test_musait_araclar.py` müsait araçları GET ile
   getirir. Terminalde araçların `Rez_ID`, `Group_ID`, araç adı ve ücret gibi
   alanları XML olarak görünür. Tam yanıt
   `reports/api_xml/musait_araclar.xml` dosyasına yazılır. Dev API ara sıra
   yavaşladığı için bu arama yanıtını 60 saniyeye kadar bekler. Bağlantı
   yanıt gelmeden kesilirse yalnız bu müsait araç araması bir kez daha denenir.
   Hata sürerse token gösterilmeden ağ hatasının türü yazılır. Rezervasyon
   kaydeden POST ve rezervasyonu değiştiren iptal GET'i tekrarlanmaz.

   ```sh
   TEST_ENV=dev python3 -m pytest -s tests/api/test_musait_araclar.py
   ```

2. **Kaydet:** `tests/api/test_rezervasyon_kaydet.py` aynı çalışmada önce yeni
   bir müsait araç GET'i yapar, bir aracın `Rez_ID` ve `Group_ID` değerlerini
   alır, ardından POST gönderir. GET aramasındaki `Currency`, `Pickup_*` ve
   `Drop_Off_*` alanları POST'a **değişmeden** aktarılır. Collection'daki gibi
   bu alanlar **URL/Params** içindedir; POST'un HTTP Body alanı boştur.
   `.env` içinde `BROKER_TEST_NAME`, `BROKER_TEST_SURNAME`,
   `BROKER_TEST_MOBILE_PHONE` ve `BROKER_TEST_EMAIL` gerekir.
   `BROKER_GENERATE_RENTAL_ID=true` ile her çalışmada yeni bir sentetik test
   pasaport ID'si üretilir; bu sayede aynı örnek kimlikteki rezervasyon
   çakışması tekrarlanmaz. Sabit bir test T.C. kimlik/pasaport numarası
   kullanacaksanız `BROKER_GENERATE_RENTAL_ID=false` ve
   `BROKER_TEST_RENTAL_ID=...` yazın. Gerekirse `BROKER_ECOP_ID` ayarlanabilir.
   Önceki Postman örneğinizdeki
   `Full_Credit=TRUE` için `BROKER_FULL_CREDIT=true` yazabilirsiniz; collection
   export'unda bu alan kapalı olduğundan varsayılan isteğe eklenmez.

   ```sh
   TEST_ENV=dev E2E_ALLOW_WRITE=true python3 -m pytest -s tests/api/test_rezervasyon_kaydet.py --run-broker-save
   ```

   Test, POST yanıt XML'inde `Key` değerinin gönderilen `Rez_ID` ile aynı ve
   `Status` değerinin `200` olduğunu kontrol eder. Yanıt
   `reports/api_xml/rezervasyon_kaydet.xml` dosyasına yazılır.
   Kullanılan `Rez_ID` ve arama alanları, ad/telefon/e-posta yazılmadan
   `reports/api_bookings/` klasörüne kaydedilir. Oluşturulan sentetik pasaport
   ID'si de bu yerel sonuçta görünür. XML `Key`/`Status` kontrolünü geçen son
   kayıt ayrıca `son_rezervasyon.json` dosyasında tutulur.

3. **Ayrı komutla iptal et:** `tests/api/test_rezervasyon_iptal.py`, son kayıt
   dosyasındaki `Rez_ID` ile collection'daki iptal GET isteğini gönderir.
   İstek adı GET olsa da gerçek rezervasyonu değiştirebilir. Kaydetme testi
   iptali otomatik çalıştırmaz; önce son kayıt dosyasını inceleyin.

   ```sh
   TEST_ENV=dev E2E_ALLOW_WRITE=true python3 -m pytest -s tests/api/test_rezervasyon_iptal.py --run-broker-cancel
   ```

   İptal yanıtı `reports/api_xml/rezervasyon_iptal.xml` dosyasına yazılır.
   Collection'da kaydetme ve iptal için kayıtlı yanıt şeması bulunmadığından
   Kayıtta `Key` ve `Status` kontrolü yapılır; bu yanıt, ayrı bir rezervasyon
   sorgulama API'si bulunmadığından veri tabanından bağımsız doğrulama sağlamaz.
   İptalde de sonuç XML'ini inceleyin. Bu iki değişiklik yapan test, yukarıdaki
   açık seçenekler verilmediğinde atlanır.

`Rezervasyon kaydet: HTTP 400` olursa ayrıntı
`reports/api_xml/rezervasyon_kaydet_hata.xml` içinde görünür. Dev ortamında
örnek müşteriyle 7 ve 14 gün sonrası için sunucu, “Bu müşterinin belirtilen
tarihlerde rezervasyonu bulunmaktadır.” yanıtını verdi. Bu durumda testin
gönderdiği tarihleri ve kullanılacak test müşterisini kontrol edin; yalnız bu
hataya bakarak mevcut rezervasyonu otomatik iptal etmeyin.

- Eksik giriş ayarı: seçilen ortam ve role ait değişkenleri kontrol edin.
- Tarayıcı bulunamıyor: aktif sanal ortamda `python -m playwright install chromium` çalıştırın.
- Profil kullanımda: aynı `user_data/` ile çalışan diğer test tarayıcısını kapatın veya `CI=true` kullanın.
- GitLab'da import hatası: gereken kaynak dosyaların commit'e dahil olduğunu kontrol edin.

`.env`, `user_data/`, sanal ortamlar ve raporlar Git'e eklenmez. Son yerel
doğrulamada FAYT unit kontrolleri 15/15 ve validation kiralama dönüşü yakıt alma
akışı 1/1 geçmiştir. GitLab runner koşusu ayrıca doğrulanmalıdır.
