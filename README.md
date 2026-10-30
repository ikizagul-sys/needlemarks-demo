# NEEDLEMARKS — Mağaza projesi ve müşteri demosu

Türkçe kişiye özel nakış mağazası. Gerçek ödeme, üretim ve kargo bağlantıları kapalıdır. GitHub Pages demosu ile yerel veritabanlı sürüm aynı arayüzü kullanır.

## Demo

Mağaza: https://ikizagul-sys.github.io/needlemarks-demo/

Panel: https://ikizagul-sys.github.io/needlemarks-demo/#/admin

GitHub demosunda **Demo paneli aç** düğmesini kullanın. Hesap ve yönetim ekranları örnek verilerle açılır. Değişiklikler sadece aynı tarayıcının localStorage alanında saklanır; başka cihazlara aktarılmaz. Başlangıçta üç açıkça işaretli örnek sipariş vardır. Panelden demo verileri sıfırlanabilir. Gerçek kişisel bilgiler yerine örnek bilgiler kullanın.

## Yerel sunucu ve veritabanı

Node.js 24 veya üzeri gerekir; harici paket veya veritabanı kurulumu gerekmez.

```sh
node server/server.mjs
```

Mağaza: `http://127.0.0.1:4185/` · Panel: `http://127.0.0.1:4185/#/admin`

İlk açılışta SQLite veritabanı `.local/store.sqlite` içinde oluşturulur. Rastgele yönetici bilgileri yalnızca `.local/admin-access.json` dosyasına kaydedilir. Bu dosyayı paylaşmayın ve Git'e eklemeyin. Alternatif olarak ilk açılıştan önce `ADMIN_EMAIL` ve en az 12 karakterli `ADMIN_PASSWORD` ortam değişkenleri tanımlanabilir. Mevcut yönetici sonraki açılışlarda otomatik değiştirilmez.

`PORT`, `HOST`, `APP_URL`, `DATA_DIRECTORY` ortam değişkenleri desteklenir. Farklı port/origin için `APP_URL` değerini de değiştirin. Tarayıcıda aynı origin kullanın; localhost ve 127.0.0.1 farklı oturumlardır. Sunucuyu durdurup `.local/` dizininin tamamını yedekleyin; sunucu açıkken sadece SQLite dosyasını kopyalamak WAL verisini kaçırabilir.

## Mağaza

- Ana sayfa, koleksiyon, ayrı ürün ayrıntıları, ilgili ürünler.
- Ad arama; kategori, fiyat ve beden filtresi; fiyat sıralama; favoriler.
- Renk, beden, adet, kişiselleştirme notu, örnek beden rehberi ve fotoğraf seçimi.
- Fotoğraf galerisi, sepet düzenleme, kupon ve indirim sonrası ücretsiz kargo eşiği.
- 81 il, ilçe, açık adres ve isteğe bağlı posta koduyla misafir veya üye demo siparişi.
- Sipariş ayrıntısı, durum çizgisi, hesap sipariş listesi ve oturuma bağlı takip.
- Hikâyemiz, nasıl çalışır, SSS, gerçek mesaj göndermeyen iletişim formu.

## Yönetim

- Genel bakış: demo sipariş tutarı, sipariş/ürün/stok sayıları, son siparişler.
- Ürün ekleme/düzenleme; taslak/yayın; fiyat, toplam stok, renk, beden, açıklama ve ürün arama.
- En fazla 8 ürün fotoğrafı; kapak seçme, kapak görselini başa alma ve görsel kaldırma.
- Sipariş, teslimat ve kişiselleştirme bilgileri; müşteri kayıtları; sipariş durumu yönetimi.
- Kupon yüzdesi, minimum sepet, kullanım limiti ve aktiflik.
- Duyuru, kargo ücreti/eşiği, hazırlık süresi, destek e-postası ve marka hikâyesi ayarları.

## Çalışma biçimleri

| Özellik | GitHub Pages | Yerel Node.js |
|---|---|---|
| Veri kalıcılığı | Aynı tarayıcı | SQLite |
| Müşteri hesabı | Örnek hesap düğmesi | E-posta/parola ve sunucu oturumu |
| Yönetim | İşaretli demo paneli | Her yönetim API çağrısında rol kontrolü |
| Kişisel fotoğraf | Açık oturumda önizleme | Özel disk alanı; sahip oturum veya yönetici |
| Ürün fotoğrafı | Tarayıcıda; toplam 2 MB sınırı | Görsel başına 5 MB, herkese açık ürün görseli |
| Gerçek ödeme/gönderim | Kapalı | Kapalı |

## Sunucu kuralları

Parolalar scrypt ile tuzlanır; oturum anahtarlarının SHA-256 özeti saklanır. Çerezler HttpOnly/SameSite Strict, HTTPS origin'de Secure'dur. Giriş denemeleri sınırlandırılır. Mutasyonlar JSON, özel istek başlığı ve origin kontrolü ister. Kayıtta rol istemciden alınmaz.

Fiyatlar kuruş cinsinden tamsayıdır. İstemcinin gönderdiği fiyat/toplam kabul edilmez. Sipariş, stok ve kupon aynı SQLite transaction içinde güncellenir. Aynı sipariş anahtarı ikinci stok düşümü yapmaz. Farklı kişiselleştirme satırları aynı ürünün stok sınırına birlikte tabidir. Ürün değişikliği eski sipariş snapshot'ını değiştirmez.

Stok ürün toplamıdır; renk/beden başına ayrı stok yoktur. Demo siparişi stok düşürür; gerçek ödeme rezervasyonu, tahsilat, otomatik iptal/iade yapılmaz. Durum güncellemesi gerçek üretim veya gönderim başlatmaz.

Kişisel fotoğraflar `.local/uploads`, herkese açık ürün görselleri ayrı `.local/product-images` içindedir. PNG/JPEG/WebP dosya imzası ve boyut kontrolü vardır; SVG kabul edilmez. Dosyalar bu sürümde yeniden kodlanmaz veya kırpılmaz.

## GitHub Pages güncellemesi

```sh
node scripts/build-demo.mjs
```

Yalnızca izin verilen statik dosyalar `docs/` dizinine kopyalanır. Kaynak değişiklikleriyle `docs/` birlikte commit edilmelidir. Pages: **Deploy from a branch → main → /docs**. Özel veritabanı, kullanıcılar, oturumlar, yüklenen kişisel dosyalar ve yönetici bilgileri demo çıktısına dahil edilmez. GitHub Pages erişilebilir bir internet önizlemesidir; noindex erişim kontrolü değildir. Alan adı bağlanmadı.

## Doğrulama

```sh
node --test tests/server.test.mjs
node --check app.js
node --check data.js
node --check server/server.mjs
node --check server/store.mjs
```

9 otomatik test ve 16 yerel HTTP kontrolü başarılı. Tarayıcı kontrolü özeti QA.md dosyasındadır.

## Mevcut sınırlar

Bu bir müşteri demosu ve yerel geliştirme temelidir. Gerçek katalog/ölçüler/fiyatlar, şirket bilgileri ve ticari metinler, ödeme sağlayıcısı, kargo, e-posta/parola sıfırlama, faturalama, sunucu/HTTPS, yedekleme/geri yükleme ve üretim güvenlik kabulü henüz bağlanmadı. Sipariş listesi 500 kayıtla sınırlıdır; büyük operasyon için sayfalama ve raporlama gerekir. Theseart'ın kodu kopyalanmadı; NEEDLEMARKS için yeni Node.js/SQLite temeli hazırlandı.

Logo kullanıcı tarafından sağlandı. Dört görsel yerleşik Imagegen ile demo için üretildi; gerçek ürün fotoğrafı değildir. Rakibin ürün görselleri kullanılmadı. Briefler IMAGE-PROMPTS.md içindedir. Google Fonts kullanılamazsa Arial/Georgia yedekleri devreye girer.
