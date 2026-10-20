# GitLab CI/CD kullanımı

Pipeline yeni bir test, component veya page kullanmaz. Otomatik `login_smoke` işi
mevcut `tests/test_1000_login.py` dosyasını headless Chromium ile çalıştırır.
Gerçek veri oluşturan mevcut testler ortam ve role göre ayrı işlerde tutulur.

## GitLab değişkenleri

**Settings → CI/CD → Variables** bölümünde en az aşağıdakileri masked/protected
olarak tanımlayın:

- `VALIDATION_URL`
- `SHORT_VALIDATION_EMAIL`
- `LONG_VALIDATION_EMAIL`
- `VALIDATION_USER_PASSWORD`

Dev UI işleri için `DEV_URL`, `SHORT_DEV_EMAIL`, `LONG_DEV_EMAIL` ve
`DEV_USER_PASSWORD` değişkenlerini tanımlayın. Broker API işleri `TEST_ENV=dev`
değerini kendileri seçer.
Eski yerel `.env` dosyasındaki `USER_PASSWORD` ve `validation_USER_PASSWORD`
adları geriye uyumluluk için desteklenmeye devam eder.

Broker API işleri için `DEV_URL`, `BROKER_TOKEN`, `BROKER_COMPANY_ID` ve
`BROKER_APPLICATION_ID` CI/CD değişkenlerini tanımlayın. Rezervasyon kaydetme
işinde ayrıca `BROKER_TEST_NAME`, `BROKER_TEST_SURNAME`,
`BROKER_TEST_MOBILE_PHONE`, `BROKER_TEST_EMAIL` ve
`BROKER_GENERATE_RENTAL_ID=true` gerekir. Sabit test kimliği için bunun yerine
`BROKER_TEST_RENTAL_ID` kullanılabilir. `BROKER_DAYS_AHEAD`,
`BROKER_RENTAL_DAYS`, ofis, saat ve para birimi ayarları isteğe bağlıdır.
Token veya müşteri değerlerini `.gitlab-ci.yml` dosyasına yazmayın.

## İşler

- `python_syntax`: dış ortama bağlanmadan bütün Python dosyalarını derler.
- `unit_tests`: mevcut `tests/unit` kontrollerini dış ortama veri yazmadan çalıştırır.
- `login_smoke`: validation ortamında mevcut login testini otomatik çalıştırır.
- `short_term_tests`: dev ortamında short kullanıcıyla kısa dönem ve kurumsal
  kısa dönem testlerini çalıştırır.
- `long_term_tests`: dev ortamında long kullanıcıyla uzun dönem testini çalıştırır.
- `vehicle_washing_tests`: validation ortamında short kullanıcıyla araç yıkamayı
  çalıştırır.
- `rental_return_fuel_tests`: validation ortamında short kullanıcıyla kiralama
  dönüşü yakıt alma workflow'unu çalıştırır.
- `api_smoke_dev`: Play ile başlayan, yalnız Tema/collection/müsait araç GET
  testlerini çalıştıran dev işi. Tam XML'ler artifact olarak yüklenir.
- `api_booking_save_dev`: Play ile başlayan dev rezervasyon kaydetme işi.
- `api_booking_cancel_dev`: aynı pipeline'daki kayıt işi bittikten sonra Play
  ile başlayan iptal işi; kayıt işinin küçük sonuç artifact'ını kullanır.
  API yanıt XML'leri ve hata XML/TXT dosyaları ilgili işin artifact'ında olur.

Bu işler tek tek Play düğmesiyle çalıştırılabilir. **Run pipeline** ekranında
`RUN_E2E=true` değişkeni verilirse tüm E2E işleri başlar. Araç yıkama ve yakıt
alma işleri aynı `resource_group` değerini kullandığından validation araçları
üzerinde aynı anda çalışmaz. Her test yeni browser context
kullandığı için önceki kullanıcının cookie ve oturum bilgileri taşınmaz.

Kod, `TEST_ENV=prod` ile `E2E_ALLOW_WRITE=true` birleşimini ayrıca reddeder.
Broker API işleri `RUN_E2E=true` ile otomatik çalışmaz. Kayıt/iptal işleri
birbirinden ayrıdır; kayıt işi kendiliğinden iptal etmez. Kayıt işinden iptale
yalnız `Rez_ID`, ortam ve kayıt durumu aktarılır. Artifact süresi 7 gündür;
bu süre geçince aynı pipeline'da iptal işi dosyayı alamaz. API işleri tarayıcı
trace/video/screenshot üretmez, böylece API başlıkları bu dosyalara girmez.

JUnit sonuçları `test-results/*.xml`, hata ekranları
`test-results/screenshots/`, HTML raporları `reports/html/` yolundan GitLab'a
artifact olarak yüklenir. Ortam şirket ağı/VPN arkasındaysa runner'ın da aynı
ağa erişebilmesi gerekir.
