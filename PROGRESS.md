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

## Önceki istek: görsel kategori kartları

Kategoriler ekranı kullanıcının son gönderdiği referans gibi iki sütunlu fotoğraflı kartlara çevrildi. Mobilde tek sütun. Her kartta kapak, aktif/pasif bilgisi, ürün sayısı, kategori adı, bağlantı adı ve Düzenle var. Yeni ekle düğmesi üst sağdadır.

Kategori düzenleme formunda kapak fotoğrafı yüklenebilir; ad, bağlantı adı ve Mağazada göster seçimi değiştirilebilir. Yeni adın bağlantısı Türkçe karakterler dönüştürülerek otomatik hazırlanır; kullanıcı elle değiştirebilir. Aynı bağlantı adı ikinci kategoriye verilemez. Fotoğraf tanımlanmamış eski kategorilerde o kategoriye ait ilk ürün fotoğrafı kullanılır; boş kategoride açıklayıcı yer tutucu vardır.

Pasif kategori mağaza kategori menülerinde ve footer'da gösterilmez; doğrudan kategori bağlantısı da açılmaz. Ürünleri silinmez ve tüm ürünler listesinden kaldırılmaz. Mevcut ID ile açılan kategori bağlantıları çalışmaya devam eder; yeni footer bağlantıları okunabilir bağlantı adını kullanır. Koleksiyonların liste düzeni değişmedi.

## Doğrulama

- `node --test tests/server.test.mjs`: 13/13 başarılı. Son test kategori kapak görseli, bağlantı adı, görünürlük, tekrar kaydetmede verinin korunması, bağlantı çakışması ve geçersiz görsel reddini kapsar.
- Önceki kapsamda 16 temel HTTP ve 12 kategori/içerik HTTP kontrolü başarılı; ayrıntılar QA.md içinde.
- Son kategori kartları ve düzenleme formu tarayıcıda kontrol edildi. Mağazada göster kapatılıp kaydedildi; kart Kategori pasif durumuna geçti.
- Önceki turda mobil yönetim ve sade ürün formundaki taşma düzeltildi. Kartlar için responsive tek sütun CSS'i mevcut.

## İki çalışma biçimi — önemli

GitHub Pages yalnızca statik demo sunar. Panel değişiklikleri ziyaretçinin kendi tarayıcısındaki IndexedDB veritabanına kaydedilir; başka cihazları veya GitHub kaynak dosyalarını değiştirmez. Demo kişisel fotoğrafı sunucuya göndermez. Paylaşılan başlangıç verileri `data/catalog.json` dosyasındadır.

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

Son bırakılan bölüm Yönetim → Ürünler → Ürünü düzenle → Varyasyonları yönet. Etsy benzeri yönetim penceresi ve görselli nakış konumu seçimi tamamlandı; sonraki düzenleme isteği bekleniyor. Gerçek ürün/kategori fotoğrafları, kesin içerikler ve ticari metinler henüz marka tarafından sağlanmadı. Gerçek ödeme, kargo, e-posta, faturalama ve üretim yayını bağlı değil. Bu işleri tamamlanmış gibi sunmayın ve kullanıcı istemeden satışa açmayın.

## Dağıtım önbelleği notu

GitHub Pages eski JavaScript dosyalarını önbellekte tutabildiği için demo oluşturucusu statik dosyalardan bir sürüm özeti hesaplar. docs/index.html içindeki JS/CSS bağlantıları, docs/ altındaki modül importları ve katalog isteği bu sürümü ?v= ile taşır. Kaynak dosyalarını elle sürümlemeyin; her güncellemede `node scripts/build-demo.mjs` çalıştırmak yeterlidir. Yeni sürümü ilk kez kontrol ederken demo adresine de ?v=SURUM eklenebilir.

## Son istek: Etsy benzeri ürün seçenekleri — tamamlandı

- Varyasyonlar ile kişiselleştirme alanları ürün formunda ayrı bölümler. Her başlık ve seçenek kullanıcı tarafından eklenir, düzenlenir ve silinir.
- En fazla 2 varyasyon grubu, grup başına 30 seçenek ve toplam 100 birleşim. Örnek: Nakış yeri → Sağ kol / Sol kol / İki kol.
- İsteğe bağlı birleşim tablosunda ayrı fiyat ve stok. Kapalıysa ortak ürün fiyatı/stoku. Ana ürün stoku toplam sınır, birleşim stoku ek sınırdır. Stok sıfır seçimi siparişte reddedilir. Renk/beden eski Ek bilgiler alanında uyumluluk için korundu; bu iki alan birleşim tablosuna otomatik dahil edilmez.
- En fazla 5 kişiselleştirme alanı: metin (1–1024 karakter), seçim listesi (30 seçenek), fotoğraf (1–5 dosya, her biri 5 MB PNG/JPEG/WebP). Serbest başlık, açıklama, zorunlu/isteğe bağlı ayarı.
- Müşteri seçimleri ürün sayfasından sepete, teslimat özetine ve siparişe taşınır. Sipariş anındaki alan adları/değerleri/fiyatı saklanır; ürün sonradan düzenlenince geçmiş sipariş değişmez.
- Ortak product-options.js doğrulaması demo ve SQLite sürümünde kullanılır. Gerçek sunucu fiyat, toplam stok, birleşim stoku ve tüm fotoğrafların oturum sahipliğini denetler. Sipariş, stok düşümü ve kupon transaction içinde; tekrar gönderme stok düşürmez.
- GitHub demosunda fotoğraf içeriği yüklenmez veya kalıcı saklanmaz; yalnızca seçilen dosyanın adı ve demo kimliği siparişte gösterilir. Gerçek sunucuda özel fotoğraflar korumalı saklanır.
- Yeni ziyaretçiler için Çift nakışı ürününe örnek Nakış yeri, Sağ kol/Sol kol isimleri, iplik rengi ve 3 fotoğraf alanı eklendi. Önceden localStorage ile kaydedilmiş kataloglar otomatik değiştirilmez.
- Yeni dosyalar: product-options.js (şema ve sipariş doğrulama), options-ui.js (yönetim alanları, birleşim tablosu, müşteri alanları). Statik sunucu izin listesine ve demo oluşturucusuna eklendi.
- Doğrulama: 18 Node/SQLite testi başarılı. Tarayıcıda varyasyon oluşturuldu, İki kol fiyatı 2290 TL/stoku 3 yapıldı, Sağ kola yazılacak isim alanı eklendi, ürün kaydedildi, müşteri İki kol/Milo seçimiyle demo siparişi oluşturdu; fiyat ve tüm bilgiler siparişte görüldü.
- Etsy yalnızca davranış referansı: https://help.etsy.com/hc/en-us/articles/360000344528-How-to-Offer-Personalized-Listings ve https://help.etsy.com/hc/en-us/articles/115015664047-How-to-Add-Variations-to-Your-Listings . Etsy hesabına/API'sine bağlı değildir.

Temiz tarayıcıda ilk açılış ayrıca test edildi. Örnek sipariş verisi geçmiş kayıt gibi sabit fiyatla oluşturulur; yeni varyasyon seçimi beklemez. Boş localStorage ile demo başlangıcı ve kişiselleştirilmiş sipariş için regresyon testi eklendi.

## Son güncelleme: kartlı varyasyon yöneticisi ve görselli nakış konumu

Önceki varyasyon sınırı/arayüz açıklamalarının yerine bu bölüm geçerlidir.

- Ürün formundaki Varyasyonları yönet düğmesi ayrı pencere açar. Grup kartlarında ad, seçenek sayısı, seçenek etiketleri ve düzenle/sil düğmeleri var. Ürüne uygula pencereyi kapatıp üründeki taslağa uygular; kalıcı kayıt için ürünün Kaydet düğmesi kullanılır. Vazgeç pencere değişikliklerini ürüne uygulamaz.
- En fazla 3 grup / grup başına 30 seçenek / toplam 400 birleşim. Beden, Renk, Nakış konumu hazır başlangıçları ve serbest grup var. Başlıklar/seçenekler düzenlenir. Yeni ürünlerde varyasyon otomatik zorunlu değildir; boş bırakılabilir. Bir ürüne eklenen grup diğer ürünleri etkilemez.
- Fiyatlar farklı, Stoklar farklı, Ürün kodları farklı bağımsız anahtarlar. Her birinde ayrı olarak yalnızca bir gruba veya tüm grupların birleşimine göre değer atanabilir. Örn. fiyat nakış konumuna, stok bedene, SKU renge göre. Kapalı anahtar ortak ürün değerini kullanır. Ortak SKU Ek bilgiler altında, isteğe bağlıdır.
- Stok grubu ortak olduğunda renk/konum değişse de aynı stok havuzu kullanılır; aynı gruptan sepetteki satırlar birlikte doğrulanır. Siparişte doğru havuz ve toplam ürün stoku düşer. İstemciden gelen fiyat/SKU kabul edilmez. Sipariş anlık görüntüsünde SKU da saklanır.
- Nakış konumu türü müşteriye tişört çizimli radyo kartları gösterir. Yönetici her seçeneğin sağ kol, sol kol, sol göğüs, göğüs ortası, sırt veya ön taraftaki görsel işaretini seçebilir. Seçenek adları serbesttir. Konum grubu olmayan üründe bu bölüm görünmez. Şimdilik tek konum seçilir; çoklu nakış konumu siparişi ve konuma koşullu kişiselleştirme alanları eklenmedi.
- Eski renk/beden alanları yeni formda varyasyon kartlarına taşındı; müşteri sayfasında çift seçenek gösterilmez. Daha önce özel stok tablosu olan eski ürünler veri kaybı olmaması için eski renk/beden uyumluluğunu korur. Eski varyasyon tablosu okuma ve sipariş testleri geçer.
- Yeni ziyaretçi örneği: Çift nakışı ürününde beden/renk/4 nakış konumu, konuma göre fiyat, bedene göre stok ve ortak SKU. Önceden localStorage'a kaydedilmiş ürünler kullanıcı değişiklikleri korunarak bırakılır.
- 21 test geçti: önceki 18 teste ek olarak bağımsız fiyat/stok/SKU kapsamı, grup stok havuzunun farklı renk/konumlarla aşılamaması, kapalı ayarlarda ortak değer ve varyasyonsuz ürün siparişi. Temiz tarayıcı demo başlangıcı testi yeni örneğe uyarlandı.
- Tarayıcıda 3 grup oluşturuldu; fiyat nakış konumuna, stok bedene, SKU renge bağlandı. M / Yeşil / Sağ kol seçimiyle 2190 TL ürün fiyatı ve NM-YESIL SKU siparişe geçti; görselli konum kartları doğrulandı.

## Son düzeltme: 5 MB fotoğraflar, vitrin sürükle-bırak ve depolama hatası

- Hatanın nedeni: ürün galerisinde dosya başına 5 MB denetimine ek olarak tüm fotoğraflar için 2 MB toplam demo sınırı vardı. İkinci 1,5 MB dosya bu yüzden reddediliyordu. Aynı fotoğrafın hem image hem images içinde base64 olarak localStorage'a yazılması küçük JSON kotasını da dolduruyordu.
- Toplam 2 MB sınırı kaldırıldı. Ürün, vitrin, kategori ve banner görsellerinde dosya başına 5 MB PNG/JPEG/WebP. Ürün başına 8 fotoğraf sınırı korunur.
- Yeni demo-storage.js: metadata ve ikili fotoğraflar IndexedDB içindeki records/images tablolarında. JSON yalnızca nm-image:UUID referansları içerir. Açılışta Blob URL'leri yeniden oluşturulur. Fotoğraflar tekrar tekrar base64 JSON'a kopyalanmaz.
- Eski nm2-* localStorage kayıtları, siparişler ve fotoğraflar korunarak taşınır. Eski anahtarlar yalnızca başarılı atomik IndexedDB işleminden sonra kaldırılır. Başarısız taşımada eski veri kalır. Kullanıcıya tarayıcı verilerini silmesini söylemeyin.
- Ürün kaydı IndexedDB işlemi bitene kadar bekler. Başarısız ürün kaydı ürün listesini bellekte değiştirmez. Gerçek tarayıcı/cihaz kotası veya tamamen engellenmiş depolama halinde anlaşılır hata gösterilir; kalıcı kayıt olmadan başarı mesajı verilmez.
- Vitrin için ayrı bırakma alanı var. Bilgisayardan tek dosya bırakılır/seçilir veya galerideki bir küçük fotoğraf sürüklenir. İçeriden sürükleme dosya sayısını artırmadan seçilen fotoğrafı ilk sıraya alır. Tıklayarak kapak seçme de korunur.
- 23 Node/SQLite testi başarılı: 5 MB sınırı (1,5 MB / 4,9 MB / tam 5 MB kabul; 5 MB+1 bayt ret), yanlış dosya türü, kapak değişiminde diğer fotoğrafların korunması dahil.
- Gerçek tarayıcı depolama regresyon sayfası (work/storage-qa): base64 eski ürün taşınması, başarı sonrası eski ağır JSON'un kaldırılması, dolu localStorage'a rağmen 1,5+4,9 MB görsel ve katalog kaydı, 5 MB üzerinin reddi, yenileme sonrası iki Blob'un doğru byte boyutu ve localStorage erişimi kapalıyken metadata kaydı geçti.
- Uygulama arayüzünde 1,5 MB ve 4,9 MB dosyalar birlikte yüklendi, galeri 1'den 3 fotoğrafa çıktı. İkinci fotoğraf sürüklenerek vitrin yapıldı; ürün kaydedilip sayfa yenilendi, 3 görsel ve seçilen vitrin korundu.
- Yeni modül demo oluşturucusuna ve yerel statik sunucu izin listesine eklendi. GitHub demosu halen yalnızca aynı tarayıcıya kayıt yapar; müşteriler arasında ortak veritabanı değildir.
