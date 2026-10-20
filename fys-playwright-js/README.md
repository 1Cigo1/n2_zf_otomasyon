# FYS JavaScript test otomasyonu

Yeni başlayanlar için önce [Başlangıç rehberi](docs/START_HERE.md) dosyasını okuyun.

Bağımsız Playwright projesi. Python `zf_task` projesinden kod, profil, `.env` veya çalışma zamanı bağımlılığı yoktur. Bu klasörü tek başına başka konuma taşıyabilir ve ayrı GitLab deposuna gönderebilirsiniz.

Python testlerinin JavaScript karşılıklarını ve değişiklik yapılacak dosyaları
[test eşleme rehberinde](docs/PYTHON_JS_MAP.md) görebilirsiniz.

Mono, normal kısa dönem ve sözleşme bazlı kurumsal kısa dönem akışları ayrı UI
testleri olarak bulunur. İki rezervasyon türü de ortak sözleşme → teslim → iade
yaşam döngüsünü kullanır; normal kısa dönem sıfır provizyon alır, kurumsal akış
provizyonu atlar. [Normal kısa dönem rehberi](docs/SHORT_TERM.md) ve
[kurumsal kısa dönem rehberi](docs/CORPORATE_SHORT_TERM.md). Güvenlik için
`npm test` yalnızca yerel ve kayıt oluşturmayan kontrolleri çalıştırır; canlı
testler aşağıdaki ayrı komutlarla başlatılır. Kayıt oluşturan bütün UI testleri,
Mono ve yıkama dahil, `ALLOW_WRITE_TESTS=true` ister.

## Kurulum

Node.js 22 veya üstünü kurun. Terminali **bu klasörde** açın:

```sh
npm ci
npx playwright install chromium
test -f .env || cp .env.example .env
npm run check:setup
```

`.env` içindeki `VALIDATION_EMAIL`, `VALIDATION_PASSWORD`, `DEV_EMAIL`, `DEV_PASSWORD` alanlarını doldurun. Gerçek bilgiler repoya eklenmez. Her test temiz tarayıcı oturumu kullanır; Python projesindeki açık oturuma ihtiyaç duymaz.

```sh
npm run test:login
npm run test:api
ALLOW_WRITE_TESTS=true npm run test:washing -- --headed
TEST_ENV=dev DEV_SHORT_TERM_START_OFFSET_DAYS=0 ALLOW_WRITE_TESTS=true npm run test:short-term -- --headed
ALLOW_WRITE_TESTS=true npm run test:corporate -- --headed
npm run report
```

Canlı testler varsayılan olarak headless çalışır: tarayıcı penceresi açılmaz,
sonuçlar terminalde görünür. Örneğin `npm run test:login -- --headed` pencereyi
açar. Bütün komutları `fys-playwright-js` klasöründen çalıştırın.

| Komut | Görevi / veri etkisi |
|---|---|
| `npm test` veya `npm run test:local` | Yerel HTML ve yardımcı fonksiyon kontrolleri; uygulamaya kayıt yazmaz |
| `npm run test:list` | Canlı testleri listeler; çalıştırmaz |
| `npm run test:login` | UI üzerinden login ve logout |
| `npm run test:api` | Oturum, tema, yıkama, Mono ve rezervasyon API kontrolleri |
| `npm run test:mono-api` | Mono ve özel tanımlı müşteri listesi/erişim kontrolleri |
| `npm run test:reservation-api` | Rezervasyon listesi/erişim kontrolleri |
| `ALLOW_WRITE_TESTS=true npm run test:mono` | Mono kişi ve özel tanımlı müşteri oluşturur |
| `ALLOW_WRITE_TESTS=true npm run test:washing` | Yıkama talebi oluşturur ve kapatır |
| `ALLOW_WRITE_TESTS=true npm run test:short-term` | Normal kısa dönem, sözleşme, teslim ve iade |
| `ALLOW_WRITE_TESTS=true npm run test:corporate` | Kurumsal kısa dönem, sözleşme, teslim ve iade |
| `ALLOW_WRITE_TESTS=true npm run test:lifecycle` | Her iki rezervasyon yaşam döngüsü |
| `npm run report` | Son canlı koşunun yerel HTML raporunu açar |

`test:all-live` seçilen ortamdaki canlı Playwright testlerini çalıştırır;
`test:headed` aynı testleri görünür tarayıcıyla çalıştırır. İkisi de kayıt
oluşturan arayüz senaryolarını kapsar. Broker kaydetme ve iptal testleri ayrıca
`RUN_BROKER_SAVE` ve `RUN_BROKER_CANCEL` bayrakları olmadan atlanır; iki işlem
aynı koşuda çalışmaz. Yalnız login incelemek için `test:login -- --headed`
kullanın. Yerel kontroller Chromium gerektirebilir; `npm test` HTML raporu
üretmez.

### Tüm testleri sırayla çalıştırma

Bu komutları bu klasörde çalıştırın. Üçüncü komut **validation ve dev üzerinde
gerçek test kayıtları oluşturur**. Her iki ortamın kullanıcı/test verileri ile
broker ayarları tanımlı olmalıdır; sonuç özetindeki `skipped` satırlarını da
inceleyin.

```sh
npm test
TEST_ENV=all npm run test:list
TEST_ENV=all ALLOW_WRITE_TESTS=true RUN_BROKER_SAVE=false RUN_BROKER_CANCEL=false npm run test:all-live
```

Üçüncü komut broker kayıt ve iptalini atlar. Dev rezervasyon kaydını ayrıca
oluşturmak istediğinizde şu komutu çalıştırın:

```sh
ALLOW_WRITE_TESTS=true RUN_BROKER_SAVE=true npm run test:broker:save
```

Kaydı ve `reports/api_bookings/son_rezervasyon.json` dosyasını inceledikten
sonra iptal testini ayrı komutla başlatın. Kaydetme otomatik iptal etmez.

```sh
ALLOW_WRITE_TESTS=true RUN_BROKER_SAVE=false RUN_BROKER_CANCEL=true npm run test:broker:cancel
```

Tek bir grubu çalıştırmak için aşağıdaki komut tablosunu ve “Ek arayüz
senaryoları” bölümünü kullanın. GitLab pipeline'ında yazma ve broker işleri
manuel Play düğmesiyle ayrı ayrı başlatılır.

Yıkama testi gerçek test kaydı oluşturur ve kapatır. Başarısız test otomatik yeniden denenmez; açık kalan talebin plakası/kodu `talep-bilgisi` rapor ekinde bulunur. Başarısız akışta körlemesine kapatma veya silme yapılmaz.

## Validation ve dev seçimi

Varsayılan `TEST_ENV=validation`. Ortamlar birbirlerinin kimlik bilgilerine geri düşmez.

```sh
TEST_ENV=validation ALLOW_WRITE_TESTS=true npm run test:washing
TEST_ENV=dev npm run test:login
TEST_ENV=dev npm run test:api
TEST_ENV=all npm run test:login
TEST_ENV=all npm run test:list
```

Bazı testleri validation, bazılarını dev üzerinde aynı komutta çalıştırmak için:

```sh
TEST_ENV=all ALLOW_WRITE_TESTS=true npx playwright test --project=validation-washing --project=dev-login --project=dev-api
```

Projeler: her ortam için `login`, `washing`, `mono`, `short-term`,
`corporate-short-term`, `api` (örneğin `validation-corporate-short-term`).
Ek olarak dev için `long-term`, `monthly`, `fayt-maintenance`, `broker`;
validation için `fayt-fuel` projeleri vardır.
`.env` içinde her ortamın adresi, kullanıcısı ve test verileri ayrıdır. Prod
seçeneği ve prod yazma izni yoktur.

Python projesinden farklı olarak burada giriş değişkenleri `VALIDATION_EMAIL` /
`VALIDATION_PASSWORD` ve `DEV_EMAIL` / `DEV_PASSWORD` biçimindedir. Yazma izninin
adı `ALLOW_WRITE_TESTS`'tir. Terminal/GitLab değişkenleri `.env` değerlerinden
önceliklidir.

Normal kısa dönem yaşam döngüsü bugün, testin başladığı dakikada açılır; süre 7 gündür. Aynı koşuda teslim yapıldığı için `*_SHORT_TERM_START_OFFSET_DAYS=0` olmalıdır.
Kurumsal kısa dönemde süre 45 gündür; sözleşme ve müşteri ilgili ortamın
`*_CORPORATE_CONTRACT_NUMBER` ve `*_CORPORATE_CUSTOMER_IDENTITY` ayarlarından gelir.
`.env.example` içindeki örnek sözleşme/müşteri değerlerini kendi test verinizle
eşleştirin. Müşterinin ehliyeti ve fatura adresi kayıtlıysa başka kurumsal müşteri
alanı gerekmez. Eksik bilgi modalı açılırsa yalnız o modalın istediği alanları
[kurumsal test rehberine](docs/CORPORATE_SHORT_TERM.md) göre ekleyin. CDAD ve
Ankara Çankaya (Next Level AVM) seçimi rezervasyon kodunda tanımlıdır.

CI için `VALIDATION_VEHICLE_PLATE` ve `DEV_VEHICLE_PLATE` alanlarına bu teste ayrılmış, gerekli sözleşmesi bulunan bir araç önerilir. Boş bırakırsanız açılan listedeki araçlardan rastgele seçilir. Fotoğraf alanları açılmazsa en fazla 5 farklı araç denenir. Fotoğraf alanları açıldıktan sonra araç korunur; kayıt hatasında başka araca geçilmez.

## Dosyalar ve akış

| Dosya | Görevi |
|---|---|
| `pages/login.page.js` | Arayüzden giriş, profil menüsüyle logout |
| `pages/corporate-short-term.page.js` | Sözleşme numarasıyla kurumsal rezervasyon başlangıcı |
| `components/reservations/` | Normal ve kurumsal akışın ortak form/modal bölümleri |
| `tests/ui/corporate-short-term.spec.js` | Kaydet, API doğrulama ve logout dahil kurumsal senaryo |
| `tests/ui/short-term.spec.js` | Yeni Mono müşterisiyle normal kısa dönem yaşam döngüsü |
| `tests/local/` | Canlı uygulamaya bağlanmadan davranış ve yerel DOM kontrolleri |
| `fixtures/test.js` | Teste ortam, giriş bilgileri ve gerektiğinde yazma izni sağlar |
| `support/` | Test verisi, tarih, dosya yolu ve işlem durumu yardımcıları |
| `components/reservations/rental-agreement.flow.js` | Sözleşme yükleme, normal akışta provizyon ve teslimata yönlendirme |
| `pages/vehicle-delivery.page.js` | Ortak teslim formu ve araç fotoğrafları |
| `pages/return-list.page.js` | Kimlik filtresi ve teslimde okunan plakayla doğru iade satırı |
| `pages/vehicle-return.page.js` | Ortak KM/yakıt/hasar ve iade tamamlama akışı |
| `flows/rental-lifecycle.flow.js` | Normal ve kurumsal rezervasyonların ortak yaşam döngüsü |
| `pages/washing.page.js` | Workflow URL'si, Yeni, plaka araması, talep koduyla doğru satır ve ilerletme |
| `components/washing.modal.js` | Araç seçimi, fotoğraflar, KM/yakıt, ortak seçim alanları, Kaydet/İlerlet/Onayla/Kapat |
| `tests/ui/washing.spec.js` | Login → yıkama oluştur → kapat → logout senaryosu |
| `api/fys.client.js` | Gerçek API adresleri ve yanıt kontrolleri |
| `tests/api/auth-and-washing.spec.js` | API senaryoları |
| `config/environments.js` | Ortam ayarları |
| `.gitlab-ci.yml` | CI işleri ve raporlar |

POM yapısında `tests/ui` senaryonun sırasını yazar, `pages` sayfa işlemlerini,
`components` tekrar kullanılan form ve modalları yönetir. `flows` birden fazla
sayfaya yayılan ortak süreci birleştirir. Ehliyet ve fatura modalları normal ve
kurumsal rezervasyonda ortaktır. Kurumsal ek hizmetlerde aylık dönemler varsa
her dönem işlenir; Ek Sürücü seçilmez.

Yıkama akışı:

1. Login formundan giriş yapılır.
2. `/demand/list/standart_yikama?workflow_key=standart_yikama` açılır.
3. Yeni düğmesine basılır, araç seçilir, altı fotoğraf ve açıklama doldurulur.
4. Kaydet bir kez tıklanır, tıklanan modalın kapanması beklenir. Bilgi kutusundaki `Genel Merkez` hata sayılmaz.
5. Plaka arama alanına yazılır ve gerçek büyüteç düğmesine tıklanır. Liste API yanıtı beklenir.
6. Yeni talebin kodu bulunur. Sonraki adımlarda hem kod hem plaka eşleşir; aynı aracın eski talebine gidilmez. Yeni kodun ilk listedeki en büyük sayısal koddan büyük olması beklenir; belirsizlikte test durur.
7. O satırdaki ilerlet/tamamla ikonuna basılır. Görünen alanların fonksiyonları çağrılır; İlerlet modalındaki altı fotoğraf da yüklenir.
8. KM mevcut araç KM'sinden ve önceki adımdaki KM'den düşük olamaz. Yakıt mevcut Python akışındaki gibi `4` girilir.
9. Kapat sonrası modalın kapanması doğrulanır ve döngü biter. Yeniden plaka araması yapılmaz.
10. Oturumu Kapat seçilir, login sayfasına dönüş doğrulanır.

Fotoğraf yükleme dosya adedini ve yükleniyor durumunu kontrol eder; her resme sabit saniye eklemez. `SAVE_TIMEOUT_MS=30000` **üst sınırdır**; modal 2 saniyede kapanırsa akış 2 saniyede ilerler. Fotoğraf dosyaları örnek test verisidir; altı açıya karşılık gerçek test görsellerinizi `test-data/photos` altında değiştirebilirsiniz.

Modal başlığının görünmesi formun hazır olduğu anlamına gelmez: sonradan gelen tanınmış alanlar beklenir. Seçimler, açıklama ve fotoğraflar tamamlandıktan sonra KM/yakıt en son girilir ve Tab ile alandan çıkılır. Uygulamanın yeniden çizimi sırasında eski değere dönme ihtimaline karşı değerler gönderimden önce doğrulanır.

Ortak alanlar için `select`, `appointment`, `vehicleCondition` fonksiyonları kullanılır. Yeni workflow farklı alan getirirse `fillCurrentStep` içine o alanı dolduran açık bir fonksiyon çağrısı ekleyin. `kiralama_donusu_yikama` anahtarı ayarlanabilir; bu akışın aynı form alanlarına sahip olduğu varsayımı ayrıca o ortamda doğrulanmalıdır.

## API testleri ne yapıyor?

Uygulamada gözlenen adresler kullanılır; uydurma `/login` veya `/vehicles` adresleri yoktur.

| Kontrol | Beklenen |
|---|---|
| Oturumsuz `GET /api/auth/me` | 401 veya 403 |
| `POST /api/auth/login` | 200; `access`, `refresh`, `session_key`, `application_id` alanları |
| Oturumlu `GET /api/auth/me` | 200; kullanıcı ve permissions |
| `GET /api/demand/?workflow_key=...` | 200; JSON `total` ve `result`, sayfalama sınırı ve talep alanları |
| `GET /api/company/themes` | 200; colors, assets, login_config |

APIRequestContext cookie'leri kendi belleğinde tutar; sonraki isteğe `application-id` eklenir. Token ve parola değerleri konsola yazılmaz, storage-state dosyası oluşturulmaz. Bu bölümdeki FYS oturum ve liste API testleri talep oluşturmaz/kapatmaz; broker kaydetme/iptal testleri aşağıda ayrı anlatılır. Login API'sindeki captcha ayarı ortamda değişirse servis hesabı/test ortamı desteği gerekir; CAPTCHA atlatılmaz.

## GitLab CI kurulumu

1. GitLab'da boş bir proje oluşturun. **Bu klasörün içeriği yeni deponun kökünde olmalı**; `.gitlab-ci.yml` doğrudan kökte bulunmalı. Eski Python reposuna alt klasör olarak göndermeyin.
2. Settings → CI/CD → Variables bölümünde şu değişkenleri ekleyin:

| Değişken | Gereklilik |
|---|---|
| `VALIDATION_EMAIL`, `VALIDATION_PASSWORD` | Validation hesabı |
| `DEV_EMAIL`, `DEV_PASSWORD` | Dev hesabı |
| `VALIDATION_VEHICLE_PLATE`, `DEV_VEHICLE_PLATE` | Yıkama için önerilen test araçları |
| `VALIDATION_BASE_URL`, `DEV_BASE_URL` | Yalnızca varsayılan adresler değişirse |
| `RUN_WASHING` | Otomatik yıkama için `true`; varsayılan `false` |
| `RUN_MONO` | Otomatik Mono müşteri oluşturma için `true`; varsayılan `false` |
| `RUN_SHORT_TERM` | Normal kısa dönem tam yaşam döngüsünü otomatikleştirmek için `true` |
| `VALIDATION_CORPORATE_CONTRACT_NUMBER` | Kurumsal test sözleşmesi |
| `VALIDATION_CORPORATE_CUSTOMER_IDENTITY` | Sözleşmede kullanılacak test müşterisi |
| `RUN_CORPORATE_SHORT_TERM` | Protected schedule otomasyonu; varsayılan `false` |
| `*_RETURN_KM_INCREMENT`, `*_RETURN_FUEL` | Varsayılan olarak `30` KM artış ve `2` yakıt |

Parolaları Masked/Hidden olarak kaydedin. Protected işaretlerseniz testlerin çalıştığı branch de protected olmalı; aksi halde iş kimlik bilgilerini alamaz. Test hesabına gerekli yıkama rolleri tanımlı olmalı. Docker çalıştırabilen bir runner ve her iki ortam adresine ağ erişimi gerekir.

3. Kaynak kodu yeni repoya push edin. Pipeline:
   - `local-checks`: yerel yardımcı fonksiyon testleri ve test keşfi.
   - `login-and-api`: validation ve dev için ayrı işler; login/logout ve API kontrolleri.
   - `mono-api`, `reservation-api`: iki ortamda müşteri ve rezervasyon listesi/erişim kontrolleri.
   - `mono-customer`: her ortamda manuel; `RUN_MONO=true` ile otomatik müşteri oluşturma.
   - `vehicle-washing`: her ortam için ayrı manuel iş. Run düğmesiyle başlatılır. Pipeline/Schedule değişkeni olarak `RUN_WASHING=true` verilirse otomatik çalışır ve başarısızlığı pipeline'ı başarısız yapar. Varsayılan manuel işler isteğe bağlıdır.
   - `short-term-reservation`: varsayılan manuel; rezervasyon, sözleşme, teslim
     ve iadeyi tamamlar. `RUN_SHORT_TERM=true` ile otomatikleşir.
   - `corporate-short-term-reservation`: protected branch üzerinde validation
     için manuel tam yaşam döngüsü işi; schedule otomasyonu açıkça etkinleştirilebilir.

İlk kurulumda iki ortamın da kullanıcı bilgileri gerekir. Yalnızca validation çalıştırmak isterseniz CI matrisindeki `[validation, dev]` değerini `[validation]` yapın. İş başına `resource_group` aynı ortamdaki bu projenin testlerinin eşzamanlı çakışmasını önler. Her iş `npm ci` ile kilit dosyasındaki sürümleri kurar. Playwright paketi ve Docker imajı birlikte `1.63.0` sürümüne sabitlenmiştir.

GitLab Tests sekmesinde JUnit sonuçları, job artifacts içinde hata ekran görüntüleri ve başarısız UI/API testlerinin trace dosyaları bulunur. HTML raporu form adımlarındaki hassas değerleri taşıyabildiği için yalnız yerelde üretilir ve CI artefaktına alınmaz. Artefaktlar developer erişimine sınırlandırılır; kurumsal işte 3 gün, diğer canlı işlerde 7 gün saklanır. Trace varsayılan olarak `retain-on-failure` modundadır; başarılı koşuların trace dosyası saklanmaz. Broker trace'i token başlığı nedeniyle kapalıdır. Trace oturum/istek bilgileri içerebilir; gerektiğinde `FYS_TRACE=off` ile kapatabilirsiniz. Eski `.env` dosyasındaki `TRACE=off` artık otomatik hata kaydını kapatmaz.

Bu yapı otomasyonu CI/CD hattına ekler; uygulamayı deploy etmez. Deploy pipeline'ına bağlamak için uygulama deposundan bu test projesinin pipeline'ı tetiklenebilir. Burada GitLab'a push veya runner kurulumu otomatik yapılmamıştır.

## Sorun giderme ve doğrulama durumu

- Tarayıcı bulunamıyorsa `npm run install:browsers` çalıştırın.
- Giriş bilgisi hatasında seçilen `TEST_ENV` için e-posta/parola alanlarını kontrol edin.
- `ALLOW_WRITE_TESTS=true gerekli` hatasında veri yazan komutun başına bu değişkeni ekleyin.
- Test bulunamıyorsa `TEST_ENV=all npm run test:list` ile proje ve senaryo adlarına bakın.
- Hata ekranı için `test-results/`, yerel adım raporu için `npm run report` kullanın.
- Zaman aşımında rapordaki ilk başarısız adımı inceleyin. Timeout bir üst sınırdır;
  artırmak yanlış seçiciyi veya eksik zorunlu alanı düzeltmez.

19 Ekim 2026'da kısa dönem tarihleri, müşteri araması, sözleşme/teslim ön kontrolü
ve iade listesi için ilgili **17 yerel kontrol geçti**. İki ortamda 35 canlı test
keşfedildi; testlerin listelenmesi onların canlı ortamda geçtiği anlamına gelmez.

Normal kısa dönemde bugün başlayan tarih aralığı, kimlik aramasının API yanıtını
bekleme ve iade listesinin filtreli API yanıtını bekleme düzeltildi. Dev kaydı
`ZF29500D8ES` için müşteri, rezervasyon, sözleşme, sıfır provizyon, teslim ve iade
tamamlandı; son aşama `completed`, iade KM artışı `30` oldu. Doğrulama hata
noktalarından **aynı müşteri ve rezervasyonla devam edilerek** yapıldı. Tüm
düzeltmelerden sonra yeni müşteriyle kesintisiz tam koşu ayrıca doğrulanmalıdır.

Validation yıkama ve iki ortamın login/API kontrollerinde önceki başarılı koşular
vardır. Dev kurumsal teslim/iade de önceki aynı kayıt üzerinden devam edilerek
tamamlandı. Dev yıkama, kiralama dönüşü yıkama ve GitLab runner koşusu ayrıca
doğrulanmalıdır. GitLab'daki bütün işlerin ve ortamların listesi
[başlangıç rehberindedir](docs/START_HERE.md#6-rapor-trace-ve-video).

## Python projesinden eklenen broker API testleri

Bu proje artık Python'daki broker GET → müsait araç → rezervasyon kaydet → ayrı iptal akışını da JavaScript ile içerir. Var olan oturum/Mono/yıkama API testleri `tests/api/` altında kalır; broker testleri `tests/broker/` altındadır. **Broker testleri yalnız dev ortamında** ve `dev-broker` Playwright projesinde çalışır. `.env` içine `BROKER_TOKEN`, `BROKER_COMPANY_ID`, `BROKER_APPLICATION_ID` değerlerini kendiniz girin; tokenı kodda veya GitLab YAML'da tutmayın.

Önce yalnız GET isteklerini deneyin:

```sh
npm run test:broker:read
```

Bu komutta broker ayarı eksikse testler sessizce atlanmak yerine eksik
değişken adlarıyla hata verir. Python projesinin `.env` dosyası bu ayrı
JavaScript projesine otomatik aktarılmaz.

Collection testi Postman dosyasından güvenli GET yollarını okur. Müsait araç testi İstanbul tarihine göre varsayılan olarak 7 gün sonrası başlayıp 2 gün sürer. `BROKER_DAYS_AHEAD`, `BROKER_RENTAL_DAYS`, `BROKER_PICKUP_ID`, `BROKER_DROP_OFF_ID`, `BROKER_HOUR` ile aramayı değiştirebilirsiniz. API'nin döndürdüğü XML, okunur biçimde `reports/api_xml/` altında kaydedilir; XML'i test kendisi üretmez.

Kayıt testi GET yanıtındaki aynı aracın `Rez_ID` ve `Group_ID` değerlerini, aynı tarih/ofis parametreleriyle POST isteğine taşır. Postman'daki gibi POST alanları URL/Params bölümündedir. Gerçek dev rezervasyonu oluşturduğu için komutta iki açık izin gerekir:

```sh
ALLOW_WRITE_TESTS=true RUN_BROKER_SAVE=true npm run test:broker:save
```

`BROKER_TEST_NAME`, `BROKER_TEST_SURNAME`, `BROKER_TEST_MOBILE_PHONE`, `BROKER_TEST_EMAIL` alanlarını test müşterisiyle doldurun. Ayrıca `BROKER_GENERATE_RENTAL_ID=true` kullanın veya `BROKER_TEST_RENTAL_ID` belirleyin. Kayıt başarılı olursa `reports/api_bookings/son_rezervasyon.json` dosyası sonraki iptal için `Rez_ID` tutar. Test **otomatik iptal yapmaz**; kaydı inceleyebilirsiniz. Sonra yalnız istediğinizde:

```sh
ALLOW_WRITE_TESTS=true RUN_BROKER_CANCEL=true npm run test:broker:cancel
```

İptal endpoint'i teknik olarak GET olsa da veriyi değiştirir; bu nedenle yazma izni gerekir. Kayıt ve iptal aynı koşuda yapılmaz. `reports/` Git tarafından yok sayılır. Tam XML yanıtları dev verisi içerebilir; dışarı paylaşmadan önce inceleyin.

| Eski Python testi | JavaScript karşılığı |
|---|---|
| `test_collection_get.py` | `tests/broker/collection-get.spec.js` |
| `test_musait_araclar.py` | `tests/broker/available-cars.spec.js` |
| `test_rezervasyon_kaydet.py` | `tests/broker/booking-save.spec.js` |
| `test_rezervasyon_iptal.py` | `tests/broker/booking-cancel.spec.js` |

Tema GET kontrolü zaten mevcut `tests/api/` testleri içindedir.

## Ek arayüz senaryoları

Python'daki uzun dönem, aylık rezervasyon, FAYT bakım ve kiralama dönüşü yakıt akışları ayrı JavaScript senaryoları olarak eklendi. Bunlar veri yazar; `ALLOW_WRITE_TESTS=true` olmadan çalışmaz. Tek tek seçmek için:

```sh
ALLOW_WRITE_TESTS=true npm run test:long-term
ALLOW_WRITE_TESTS=true npm run test:monthly
ALLOW_WRITE_TESTS=true npm run test:fayt-maintenance
ALLOW_WRITE_TESTS=true npm run test:fayt-fuel
```

Uzun dönem ayrı hesap için `LONG_DEV_EMAIL` ve parola, `DEV_E2E_CUSTOMER_NAME` ile `E2E_VEHICLE_GROUP` ister. Aylık akış `DEV_MONTHLY_CUSTOMER_IDENTITY_NO` kullanır. Eksik ehliyet/adres modalı açılabilecek test verilerinde isteğe bağlı `DEV_MONTHLY_CUSTOMER_*` alanları `.env.example` içinde listelenir. Mevcut normal ve kurumsal kısa dönem testleri korunmuştur.

## Yeni GitLab işleri

Mevcut GitLab pipeline'ına yalnız **manuel** broker ve yeni arayüz işleri eklendi. `broker-get-dev` GET'leri çalıştırır; `broker-booking-save-dev` dev rezervasyonu kaydeder. İnceledikten sonra aynı pipeline'daki `broker-booking-cancel-dev` işini ayrı Play düğmesiyle çalıştırabilirsiniz. İki iş arasında artifact olarak yalnız `Rez_ID`, ortam ve kayıt durumu aktarılır. Broker XML'leri ve JUnit sonucu 7 gün, yalnız Developer erişimiyle artifact olur; hassas form adımları içerebilen HTML raporu CI artifact'ına eklenmez.

`long-term-reservation`, `monthly-reservation`, `fayt-maintenance` ve `fayt-rental-return-fuel` işleri de manueldir. GitLab **Settings → CI/CD → Variables** bölümünde `.env.example` içindeki ilgili değişken adlarını tanımlayın. Yerel `.env` GitLab runner'ına aktarılmaz. Protected değişkenler yalnız protected dal işlerine verilir. Mevcut yazan UI işlerinde `ALLOW_WRITE_TESTS=true` CI tarafından açıkça atanır; yerelde ise bu değişkeni siz komutta verirsiniz. Bu yeni senaryolar için canlı ortam ve GitLab runner sonucu ayrıca doğrulanmalıdır.
