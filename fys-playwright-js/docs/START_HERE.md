# FYS JavaScript testlerine başlangıç

Bu proje, Python projesinden ayrı çalışan bir **Playwright + JavaScript** test projesidir. İlk hedefin bütün dosyaları ezberlemek değil, bir testin hangi dosyalardan geçtiğini izlemek olsun.

## 1. Bir test çalışınca ne olur?

```text
npm komutu (package.json)
  → ortam ve rapor ayarı (playwright.config.js, config/environments.js)
  → teste sağlanan nesneler (fixtures/test.js)
  → senaryo (tests/ui, tests/api veya tests/broker)
  → sayfa işlemleri (pages, components) veya HTTP isteği (api)
  → doğrulama (expect veya assert)
  → terminal, HTML/JUnit raporu ve gerekiyorsa XML
```

Örneğin `npm run test:login` komutunu [package.json](../package.json) tanımlar. [playwright.config.js](../playwright.config.js) hangi ortamın ve test dosyasının seçileceğini belirler. [fixtures/test.js](../fixtures/test.js) giriş bilgilerini `credentials` olarak sağlar. [tests/ui/login.spec.js](../tests/ui/login.spec.js) senaryoyu, [pages/login.page.js](../pages/login.page.js) ise formdaki işlemleri içerir. `expect` başarının koşulunu kontrol eder.

| Dizin | Ne ararsın? |
|---|---|
| `tests/local/` | Canlı sunucuya gitmeyen yardımcı fonksiyon kontrolleri |
| `tests/ui/` | Tarayıcıda kullanıcı gibi yapılan senaryolar |
| `tests/api/` | FYS uygulamasının çoğunlukla JSON döndüren API testleri |
| `tests/broker/` | Broker servisinin XML döndüren GET, kaydetme ve iptal testleri |
| `pages/`, `components/`, `flows/` | Arayüz adımları ve tekrar kullanılan işlemler |
| `api/`, `support/` | HTTP çağrıları, parametreler ve test verisi yardımcıları |

## 2. Kod nasıl okunur?

[Login testinden](../tests/ui/login.spec.js) sadeleştirilmiş gerçek bir örnek:

```js
import { test, expect } from '../../fixtures/test.js';
import { LoginPage } from '../../pages/login.page.js';

test('Kullanıcı giriş ve çıkış yapar @login @smoke', async ({ page, credentials }) => {
  const login = new LoginPage(page);
  await login.login(credentials);
  await login.logout();
  await page.goto('/demand/list/standart_yikama?workflow_key=standart_yikama');
  await expect(page).toHaveURL(/\/auth\/login/);
});
```

- `import`: Başka dosyadaki kodu getirir. `const`: Sonradan başka nesneyle değiştirilmeyecek değişken oluşturur.
- `test('ad', async (...) => { ... })`: Playwright'ın çalıştıracağı senaryodur. `async` ve `await`, sayfa açma veya API yanıtı gibi zaman alan işlemleri sırayla bekler.
- `{ page, credentials }`: Teste sağlanan nesnelerden yalnız gerekenleri alır. `page` tarayıcı sekmesidir; `credentials` ortamın e-posta ve parolasıdır.
- `login.login(...)` bir **işlem**, `expect(...).toHaveURL(...)` bir **doğrulama**dır. Doğrulama olmazsa test yalnız adımları çalıştırmış olur; doğru sonucu kanıtlamaz.
- `@login` ve `@smoke` etiketleri bazı komutların test seçmesini sağlar. Örneğin `test:login`, `@login` içeren testleri çalıştırır.

Arayüz testlerinde Playwright `page` ile tıklar ve doldurur; API testlerinde `request` ile HTTP çağrısı yapar. Örneğin [tests/api/auth-and-washing.spec.js](../tests/api/auth-and-washing.spec.js) içinde `request.get('/api/auth/me')` ve `response.status()` kullanılır. Bunlar Playwright'ın hazır API'leridir.

## 3. Nereden başlamalıyım?

Terminali bu projenin kökünde aç. İlk kurulumda `npm ci` ve `npm run install:browsers` çalıştır. `npm run check:setup` hangi ayar gruplarının hazır olduğunu **yalnız isimleriyle** gösterir; `.env` değerlerini basmaz. Buradaki “hazır” yalnız gerekli ayarların dolu olduğu anlamına gelir; API isteğinin kabul edileceğini garanti etmez. Sonra küçükten büyüğe git:

| Komut | Etkisi |
|---|---|
| `npm run check:setup` | Gerekli ortam ayarlarından hangilerinin eksik olduğunu değerleri göstermeden denetler |
| `npm test` | Yerel kontroller; canlı uygulamaya bağlanmaz |
| `TEST_ENV=all npm run test:list` | Canlı testleri listeler; çalıştırmaz |
| `TEST_ENV=dev npm run test:login -- --headed` | Dev giriş/çıkış testini görünür tarayıcıda çalıştırır |
| `TEST_ENV=dev npm run test:api` | Dev uygulamasının JSON API kontrollerini çalıştırır |
| `npm run test:broker:read` | Dev broker GET testleri; XML yanıtları kaydeder |
| `npm run report` | Son yerel Playwright HTML raporunu açar |

`test:api` ve `test:broker:read` farklı servisleri ve farklı yanıt biçimlerini sınar. XML görmek için broker komutunu kullan. `npm run test:all-live` **veri oluşturan arayüz senaryolarını da seçer**; öğrenirken önce tek bir grubu çalıştırmak daha kolaydır.

`TEST_ENV` için `validation`, `dev` veya `all` seçilebilir. Broker komutları kendi içinde `dev` seçer. Ayarlar [config/environments.js](../config/environments.js) tarafından **bu projenin** `.env` dosyasından okunur; Python projesinin `.env` dosyası otomatik kullanılmaz. `.env.example` alan adları ve örnek değerler içeren şablondur. Gerçek değerleri koda, rapora veya sohbete yazma.

## 4. Broker XML akışı

Broker GET için `.env` içinde `BROKER_TOKEN`, `BROKER_COMPANY_ID`, `BROKER_APPLICATION_ID` gerekir. Üçünden biri boşsa açıkça eksik **değişken adı** yazılır. [api/broker/client.js](../api/broker/client.js) bu değerleri istek başlıklarına ekler; tokenı terminale basmaz. Oturum açma API'sinin çerezli bağlantısından ayrı bir istek bağlamı kullanır.

`npm run test:broker:read` beş test çalıştırır: Ek Hizmetler, Ofisler, Araçlar, Araç Grupları ve Müsait Araçlar. İlk dört GET yolu [Postman collection kopyasından](../tests/broker/data/broker_get.postman_collection.json) okunur; test collection dosyasının tamamını otomatik çalıştırmaz. Müsait araç yolu ve parametreleri [api/broker/booking.js](../api/broker/booking.js) içindedir.

Müsait araç tarihleri **otomatik** hesaplanır: İstanbul takvimine göre varsayılan başlangıç 7 gün sonra, kiralama süresi 2 gündür. `.env` içinde `BROKER_DAYS_AHEAD`, `BROKER_RENTAL_DAYS`, `BROKER_PICKUP_ID`, `BROKER_DROP_OFF_ID`, `BROKER_HOUR` ile değiştirilebilir. Gün/ay/yıl alanları `searchParams()` tarafından oluşturulur; geçmiş gün seçmek için bu fonksiyonu değiştirmene gerek yoktur.

API gerçek XML yanıtı gönderir. [api/broker/xml.js](../api/broker/xml.js) yanıtı kontrol edip okunur biçimde kaydeder; test XML verisini uydurmaz. Terminalde ilk üç kayıt örnek olarak görünür. Tam yanıt `reports/api_xml/` altındadır: örneğin `ofisler.xml`, `musait_araclar.xml`. Bu klasör Git'e eklenmez ve dosyalar sonraki koşuda aynı adla yeniden yazılabilir. XML içinde test verisi bulunabileceği için paylaşmadan önce kontrol et.

**İstek ile yanıtı ayır:** `Pickup_Day`, `Group_ID` gibi alanlar isteğin URL parametreleri olabilir; `<Car>...</Car>` gibi etiketler sunucunun XML **yanıtındadır**. Kaydetme çağrısında POST gövdesi boştur; Postman'daki alanlar URL/Params bölümünden gider.

### Rezervasyon kaydetme ve iptal

Kaydetme için ayrıca `BROKER_TEST_NAME`, `BROKER_TEST_SURNAME`, `BROKER_TEST_MOBILE_PHONE`, `BROKER_TEST_EMAIL` gerekir. `Rental_ID` için `BROKER_GENERATE_RENTAL_ID=true` kullanabilir veya `BROKER_TEST_RENTAL_ID` belirleyebilirsin. Bu test dev ortamında **gerçek bir test rezervasyonu** oluşturur:

```sh
ALLOW_WRITE_TESTS=true RUN_BROKER_SAVE=true npm run test:broker:save
```

[tests/broker/booking-save.spec.js](../tests/broker/booking-save.spec.js) kayıttan hemen önce yeni müsait araç GET'i yapar. İlk `Rez_ID` ve `Group_ID` içeren aracı seçer. GET'teki tarih ve ofis parametrelerini aynen POST'a taşır; aracın `Rez_ID` ve `Group_ID` değerlerini ekler. Yanıtın HTTP durumunu ve XML içindeki `Key`/`Status` alanlarını doğrular. Kayıt başarılıysa `reports/api_xml/rezervasyon_kaydet.xml` ve `reports/api_bookings/son_rezervasyon.json` oluşur. Hata olursa sonuç ayrı hata XML dosyasına yazılır. API “Bu müşterinin belirtilen tarihlerde rezervasyonu bulunmaktadır” derse test kimliğini `BROKER_GENERATE_RENTAL_ID=true` ile yenileyebilirsin; aynı hata sürerse dev ortamındaki mevcut müşteri rezervasyonunu incele. Kaydı **otomatik iptal etmez**.

Kaydı inceledikten sonra ayrı komutla iptal isteği gönderebilirsin:

```sh
ALLOW_WRITE_TESTS=true RUN_BROKER_SAVE=false RUN_BROKER_CANCEL=true npm run test:broker:cancel
```

[tests/broker/booking-cancel.spec.js](../tests/broker/booking-cancel.spec.js) son kayıt dosyasındaki `Rez_ID` ile çağrı yapar. İptal endpoint'i teknik olarak **GET** kullanır ama sunucudaki kaydı değiştirir. Bu yüzden `ALLOW_WRITE_TESTS=true` gerekir. Test şu an HTTP 200 ve XML hata düğümü olmamasını kontrol eder; sistemdeki son rezervasyon durumunu ayrıca doğrulamaz. İptal sonucunu arayüzden veya uygun bir durum API'sinden incele.

## 5. Bir şeyi değiştirmek istersem?

| İstek | Bakılacak yer |
|---|---|
| Test adı veya hangi adımlar çalışıyor? | İlgili `tests/**/*.spec.js` dosyası |
| Buton/alan değişti, seçici bulunamıyor? | İlgili `pages/*.page.js` veya `components/` dosyası |
| Ortam adresi, kullanıcı veya genel zaman aşımı? | `.env.example`, kendi `.env` dosyan ve `config/environments.js` |
| Müsait araç tarihi, ofis, saat? | Önce `.env` içindeki `BROKER_*` alanları; hesap [api/broker/booking.js](../api/broker/booking.js) içindeki `searchParams()` |
| Kaydetme parametresi, müşteri alanı, `Rental_ID`? | [api/broker/booking.js](../api/broker/booking.js) içindeki `customerFromEnv()` ve `saveParams()` |
| XML alanı veya kaydedilen dosya adı? | `tests/broker/*.spec.js` içindeki `fields`/`fileName`; genel işleme [api/broker/xml.js](../api/broker/xml.js) |
| Hangi testler GitLab'da çalışıyor? | [`.gitlab-ci.yml`](../.gitlab-ci.yml) |

Önce tek dosyayı okuyup bir küçük değişiklik yap, sonra yalnız ilgili test grubunu çalıştır. `expect` veya `assert` satırını kaldırıp testi yeşile çevirmek, gerçek hatayı çözmez.

## 6. Rapor, trace ve video

Yerelde Playwright testinden sonra `npm run report` ile HTML raporunu açabilirsin. Başarısız **arayüz** testlerinde ekran görüntüsü ve trace saklanır; trace hata adımlarını incelemek içindir. `--headed` arayüz testini çalışırken canlı görmeni sağlar. Şu an **video kaydı kapalıdır**. API testlerinde izlenecek tarayıcı ekranı yoktur; broker çıktısı terminalde ve XML dosyalarında görünür. Broker testlerinde token başlığı nedeniyle trace, video ve ekran görüntüsü kapalıdır.

GitLab'da [.gitlab-ci.yml](../.gitlab-ci.yml) şu işleri tanımlar:

| İş adı | Ortam | Başlatma ve işlem |
|---|---|---|
| `local-checks` | Yerel | Otomatik; yardımcı fonksiyonlar ve test listesi |
| `login-and-api`, `mono-api`, `reservation-api` | Validation + dev | Otomatik; giriş ve mevcut verilerin API kontrolleri |
| `mono-customer` | Validation + dev | Manuel; müşteri oluşturur |
| `vehicle-washing` | Validation + dev | Manuel; yıkama talebi oluşturup kapatır |
| `short-term-reservation` | Validation + dev | Manuel; bugün başlayan rezervasyon, sözleşme, teslim ve iade |
| `corporate-short-term-reservation` | Validation | Protected branch üzerinde web pipeline'da manuel; kurumsal yaşam döngüsü |
| `broker-get-dev` | Dev | Manuel; GET istekleri ve XML yanıtları |
| `broker-booking-save-dev` | Dev | Manuel; rezervasyon oluşturur |
| `broker-booking-cancel-dev` | Dev | Aynı pipeline'daki kaydetme işinden sonra manuel iptal |
| `long-term-reservation`, `monthly-reservation` | Dev | Manuel; uzun dönem veya aylık kayıt oluşturur |
| `fayt-maintenance` | Dev | Manuel; bakım talebi akışı |
| `fayt-rental-return-fuel` | Validation | Manuel; kiralama dönüşü yakıt akışı |

Mono, yıkama ve normal kısa dönem işleri ilgili `RUN_MONO`, `RUN_WASHING`, `RUN_SHORT_TERM` değeri `true` olduğunda otomatikleşir. Kurumsal işin schedule kuralı protected branch ve `RUN_CORPORATE_SHORT_TERM=true` ister.

GitLab'ın Variables bölümüne kullanıcı, token ve test verileri ayrıca girilir; yerel `.env` runner'a taşınmaz. Ortam ve yazma bayraklarını işler seçer. Proje genelindeki `TEST_ENV` veya `ALLOW_WRITE_TESTS` değerleri YAML'daki seçimleri ezebilir; bu iki ayarı bütün işler için sabitlemeyin. [GitLab değişken önceliği](https://docs.gitlab.com/ci/variables/#ci-cd-variable-precedence).

Normal kısa dönem testi aynı koşuda teslim yaptığı için `*_SHORT_TERM_START_OFFSET_DAYS=0` gerekir; GitLab kısa dönem işi bunu tanımlar. Yerel komut örnekleri [kısa dönem rehberindedir](SHORT_TERM.md).

GitLab Tests görünümü JUnit sonucunu, job artifact'ları izin verilen raporları tutar. Bu projenin GitLab runner üzerinde başarılı çalışması ayrıca doğrulanmalıdır.

Diğer senaryoların ve mevcut doğrulama durumunun ayrıntıları için [README](../README.md) ve [Python → JavaScript test eşlemesi](PYTHON_JS_MAP.md) dosyalarına bak.
