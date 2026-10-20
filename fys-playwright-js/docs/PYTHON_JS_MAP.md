# Python testlerinden JavaScript testlerine geçiş

Bu klasör bağımsız bir projedir. Python dosyaları yerinde durur. Buradaki testleri
çalıştırmak için terminali `fys-playwright-js` klasöründe açın.

## Hangi test nerede?

| Python testi | JavaScript testi |
|---|---|
| `tests/test_1000_login.py` | `tests/ui/login.spec.js` |
| `tests/test_02_reservation.py` | `tests/ui/short-term.spec.js` |
| `tests/test_03_long_term_rental.py` | `tests/ui/long-term.spec.js` |
| `tests/test_04_corporate.py` | `tests/ui/corporate-short-term.spec.js` |
| `tests/test_05_Fayt.py` | `tests/ui/fayt-maintenance.spec.js` |
| `tests/test_06_Standart_Yikama.py` | `tests/ui/washing.spec.js` |
| `tests/test_07_Kiralama_Donusu_Yakit.py` | `tests/ui/fayt-fuel.spec.js` |
| `tests/test_08_monthly_reservation.py` | `tests/ui/monthly.spec.js` |
| `tests/api/test_basit_get.py` | `tests/api/auth-and-washing.spec.js` içindeki tema GET testi |
| `tests/api/test_collection_get.py` | `tests/broker/collection-get.spec.js` |
| `tests/api/test_musait_araclar.py` | `tests/broker/available-cars.spec.js` |
| `tests/api/test_rezervasyon_kaydet.py` | `tests/broker/booking-save.spec.js` |
| `tests/api/test_rezervasyon_iptal.py` | `tests/broker/booking-cancel.spec.js` |
| `tests/unit/test_broker_booking_data.py` | `tests/local/broker-data.test.js` |
| `tests/unit/test_ek_hizmetler.py` | `tests/local/ek-hizmetler.test.js` ve `monthly.test.js` |
| `tests/unit/test_fayt_save_wait.py` | `tests/local/fayt-save-wait.test.js` ve `fayt-workflow.test.js` |

Önceden bu JavaScript projesinde bulunan Mono, rezervasyon listesi ve diğer API
testleri de korunmuştur.

## Bir ayarı nereden değiştiririm?

| İhtiyaç | Yer |
|---|---|
| Ortam adresi, kullanıcı ve test verisi | Yerel `.env`; adlar `.env.example` içinde |
| Müsait araç aramasının kaç gün sonra başlayacağı ve kaç gün süreceği | `.env` içinde `BROKER_DAYS_AHEAD` ve `BROKER_RENTAL_DAYS` |
| Müsait araç ofisi, saati, para birimi | `.env` içinde `BROKER_PICKUP_ID`, `BROKER_DROP_OFF_ID`, `BROKER_HOUR`, `BROKER_CURRENCY` |
| Rezervasyon kaydetme müşterisi | `.env` içindeki `BROKER_TEST_*` alanları |
| GET ile kaydetmenin ortak tarih ve ofis parametreleri | `api/broker/booking.js` içindeki `searchParams` ve `saveParams` |
| XML yanıtını okuma ve rapora yazma | `api/broker/xml.js` |
| Bir UI adımının seçicisi | İlgili `pages/` veya `components/` dosyası |
| Bir testin adım sırası ve beklentisi | İlgili `tests/ui/` veya `tests/broker/` dosyası |
| GitLab işi | `.gitlab-ci.yml` |

Örnek: `BROKER_DAYS_AHEAD=10` yaparsanız müsait araç GET testi on gün
sonrasını arar. Kaydetme testi de kendi GET isteğini yeniden yapıp aynı tarihleri,
o yanıtın `Rez_ID` ve `Group_ID` değerleriyle beraber POST'a geçirir. Bu iki
kimliği elle kopyalamanız gerekmez. İptal ayrı komuttur; kaydetme testi otomatik
iptal etmez.

## Güvenli çalışma sırası

```sh
npm test
TEST_ENV=all npm run test:list
npm run test:broker:read
```

İlk komut yalnız yerel davranış kontrollerini çalıştırır. İkincisi canlı
testleri listeler. Son komut dev broker API'sine GET gönderir; JavaScript
projesinin `.env` dosyasında broker ayarları gerekir. Kaydetme ve iptal
komutları ile yazma izinleri ana [README](../README.md) dosyasındadır.

Bu aktarımda eklenen yeni senaryolar yalnız kod ve yerel testlerle doğrulandı;
canlı dev/validation ortamında ve GitLab runner üzerinde ayrıca çalıştırılmaları
gerekir.
