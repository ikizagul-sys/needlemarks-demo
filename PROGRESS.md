# NEEDLEMARKS — Kaldığımız nokta

Son güncelleme: 30 Ekim 2026. Çalışma dalı: main.

## Proje ve bağlantılar

- GitHub: https://github.com/ikizagul-sys/needlemarks-demo
- Müşteri demosu: https://ikizagul-sys.github.io/needlemarks-demo/
- Panel: https://ikizagul-sys.github.io/needlemarks-demo/#/admin
- Yerel çalıştırma: Node.js 24+ ile `node server/server.mjs`; adres http://127.0.0.1:4185/
- Yerel veritabanı ve dosyalar `.local/` içinde. Yönetici bilgisi `.local/admin-access.json` içindedir; Git'e veya arşive eklenmez.

## Kullanıcının istediği yön

Marka NEEDLEMARKS. Kişiye özel nakış ürünleri satacak. Bee Artlab ürün fikri için referans; Theseart yönetim ekranları ve alt menü düzeni için referans. Kullanıcı basit ve çalışan ekranlar istiyor. Gereksiz teknik ve ikincil alanları ana formlara doldurmayın. Kategoriler ile koleksiyonlar ayrı yönetilmeli; ürün yüklerken listeden seçilmeli. Gerçek satışa açılmadı; GitHub bağlantısı müşteriye gösterilecek demo.

## Tamamlananlar

- Ana sayfa, koleksiyon/ürün listesi, filtreler, favoriler, ayrı ürün detayı, fotoğraf ve notla kişiselleştirme.
- Sepet, kupon/kargo hesabı, teslimat formu, demo siparişi, hesap ve sipariş takibi.
- Panel: Genel bakış, Ürünler, Koleksiyonlar, Kategoriler, Siparişler, Müşteriler, Kuponlar, Bannerlar, Kargo & duyuru, Yasal metinler.
- Ürün formu: ad, fiyat, stok, isteğe bağlı açıklama, fotoğraflar ve kategori/koleksiyon seçimi. Renk, beden, malzeme ve bakım kapalı Ek bilgiler altında. Taslak ve yayınlama ayrı düğmeler.
- Kategoriler ve koleksiyonlar ayrı kayıtlar. Bir ürüne bir kategori ve birden fazla koleksiyon atanabilir. İçinde ürün olan kayıt silinemez; ad değişikliği ürün bağını korur.
- Banner başlığı/açıklaması/butonu/fotoğrafı ve görünürlüğü ana sayfaya bağlı. Kargo ayarları sepette kullanılır.
- Footer: Keşfet, Yanındayız ve Bilmen gerekenler. Kategori ve bilgi bağlantıları kendi sayfalarını açar. Yasal/bilgi metinleri panelden düzenlenir; başlangıç metinleri demo taslağıdır.

## Son istek: görsel kategori kartları

Kategoriler ekranı kullanıcının son gönderdiği referans gibi iki sütunlu fotoğraflı kartlara çevrildi. Mobilde tek sütun. Her kartta kapak, aktif/pasif bilgisi, ürün sayısı, kategori adı, bağlantı adı ve Düzenle var. Yeni ekle düğmesi üst sağdadır.

Kategori düzenleme formunda kapak fotoğrafı yüklenebilir; ad, bağlantı adı ve Mağazada göster seçimi değiştirilebilir. Yeni adın bağlantısı Türkçe karakterler dönüştürülerek otomatik hazırlanır; kullanıcı elle değiştirebilir. Aynı bağlantı adı ikinci kategoriye verilemez. Fotoğraf tanımlanmamış eski kategorilerde o kategoriye ait ilk ürün fotoğrafı kullanılır; boş kategoride açıklayıcı yer tutucu vardır.

Pasif kategori mağaza kategori menülerinde ve footer'da gösterilmez; doğrudan kategori bağlantısı da açılmaz. Ürünleri silinmez ve tüm ürünler listesinden kaldırılmaz. Mevcut ID ile açılan kategori bağlantıları çalışmaya devam eder; yeni footer bağlantıları okunabilir bağlantı adını kullanır. Koleksiyonların liste düzeni değişmedi.

## Doğrulama

- `node --test tests/server.test.mjs`: 13/13 başarılı. Son test kategori kapak görseli, bağlantı adı, görünürlük, tekrar kaydetmede verinin korunması, bağlantı çakışması ve geçersiz görsel reddini kapsar.
- Önceki kapsamda 16 temel HTTP ve 12 kategori/içerik HTTP kontrolü başarılı; ayrıntılar QA.md içinde.
- Son kategori kartları ve düzenleme formu tarayıcıda kontrol edildi. Mağazada göster kapatılıp kaydedildi; kart Kategori pasif durumuna geçti.
- Önceki turda mobil yönetim ve sade ürün formundaki taşma düzeltildi. Kartlar için responsive tek sütun CSS'i mevcut.

## İki çalışma biçimi — önemli

GitHub Pages yalnızca statik demo sunar. Panel değişiklikleri ziyaretçinin kendi tarayıcısındaki localStorage'a kaydedilir; başka cihazları veya GitHub kaynak dosyalarını değiştirmez. Demo kişisel fotoğrafı sunucuya göndermez. Paylaşılan başlangıç verileri `data/catalog.json` dosyasındadır.

Yerel Node.js sürümünde gerçek SQLite kayıtları, parola/oturum ve yetki kontrolü vardır. Para kuruş cinsinden hesaplanır; sipariş/stok/kupon aynı transaction'dadır. Özel müşteri fotoğrafları ile herkese açık ürün/kategori kapakları ayrı disk alanlarında tutulur.

## Dosyalar ve tekrar yayınlama

- `app.js`: sayfa yönlendirmeleri, olaylar ve yönetim akışları.
- `admin-catalog.js`: sade ürün formu, koleksiyon listesi, görsel kategori kartları ve düzenleyiciler.
- `catalog-rules.js`: kategori/koleksiyon atama, ad, bağlantı adı ve kapak doğrulamaları.
- `data.js`: GitHub demo veri katmanı / yerel sunucu API geçişi.
- `store-content.js`, `content-defaults.js`: footer, banner ve bilgi sayfaları.
- `server/store.mjs`, `server/server.mjs`: SQLite işlemleri ve korumalı HTTP API.
- `tests/server.test.mjs`: yalıtılmış geçici veritabanı testleri.
- `scripts/build-demo.mjs`: izin verilen statik dosyaları docs/ dizinine kopyalar. Özel dosyaları almaz.

Değişikliklerden sonra `node scripts/build-demo.mjs` çalıştırın. Kaynak dosyalarıyla docs/ çıktısını birlikte kaydedin. GitHub Pages main dalının /docs klasöründen otomatik açılır. README.md kurulum ve kapsamı; QA.md doğrulama geçmişini açıklar.

## Devam edilecek yer

Son bırakılan bölüm Yönetim → Kategoriler. Kart düzeni ve kayıt işlemleri tamamlandı; kullanıcının sonraki düzenleme isteği bekleniyor. Gerçek ürün/kategori fotoğrafları, kesin içerikler ve ticari metinler henüz marka tarafından sağlanmadı. Gerçek ödeme, kargo, e-posta, faturalama ve üretim yayını bağlı değil. Bu işleri tamamlanmış gibi sunmayın ve kullanıcı istemeden satışa açmayın.

## Dağıtım önbelleği notu

GitHub Pages eski JavaScript dosyalarını önbellekte tutabildiği için demo oluşturucusu statik dosyalardan bir sürüm özeti hesaplar. docs/index.html içindeki JS/CSS bağlantıları, docs/ altındaki modül importları ve katalog isteği bu sürümü ?v= ile taşır. Kaynak dosyalarını elle sürümlemeyin; her güncellemede `node scripts/build-demo.mjs` çalıştırmak yeterlidir. Yeni sürümü ilk kez kontrol ederken demo adresine de ?v=SURUM eklenebilir.
