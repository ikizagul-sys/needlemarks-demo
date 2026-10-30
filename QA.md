# Doğrulama — 30 Ekim 2026

- 9/9 otomatik Node/SQLite testi başarılı: hesap/rol/oturum, giriş limiti, fiyat-kupon-kargo, toplam stok, idempotency/oturum sahipliği, son stok/rollback, snapshot, fotoğraf sahipliği/durum, kupon limiti.
- 16/16 yerel HTTP kontrolü başarılı: health, yetkisiz admin reddi, kaynak/özel dosyaların sunulmaması, admin girişi ve veri erişimi, yabancı origin reddi, özel fotoğraf yükleme/sahiplik, özel fotoğrafın public media yolundan okunamaması, ürün fotoğrafında admin zorunluluğu, ürün görseli yükleme/sunma, galeri kaydetme, çıkış ve oturum iptali.
- Tarayıcı: ürün kişiselleştirme → sepet → kupon → teslimat → demo siparişi → kaydın yönetim panelinde görünmesi. 1.890 TL ürün - %10 indirim + 99 TL kargo = 1.800 TL doğrulandı.
- Yönetim paneli, ürün listesi/düzenleyici ve mobil düzen görsel olarak kontrol edildi.
- Gerçek ödeme, kargo, e-posta, nakış dönüştürme ve üretim ortamı testi yapılmadı; bunlar bağlı değildir.

## 30 Ekim 2026 — Sade yönetim ve içerik sayfaları

- 12/12 otomatik test başarılı. Yeni testler kategori/koleksiyon ayırımı, yeniden adlandırmada atamaların korunması, kullanılan grubun silinememesi, boş grup silme, geçersiz atama ve banner/bilgi metni kaydını kapsar.
- 12/12 yeni HTTP kontrolü başarılı: yetkisiz kategori işlemi reddi; ayrı kategori/koleksiyon listeleri; oluşturma ve yeniden adlandırma; kullanılan kategori koruması; banner ve yasal metin kaydı; dört istemci modülünün sunulması.
- Tarayıcıda kısa formdan taslak ürün oluşturma, kategori/koleksiyon seçimi, yeni kategori ekleme, banner düğmesi ve bilgi metni kaydetme, metnin mağaza sayfasında görünmesi ve alt menüden kategori açma kontrol edildi.

## Görsel kategori kartları

Kategori ekranı iki sütunlu fotoğraflı kartlara dönüştürüldü. Kapak fotoğrafı, ad, bağlantı adı ve aktif/pasif durumu ayrı kategori düzenleme formunda kaydedilir. Pasif kategori mağaza kategori menülerinden gizlenir; ürünler silinmez. 13/13 otomatik test başarılı; kategori görünürlük kaydı tarayıcıda doğrulandı. Kaldığımız nokta PROGRESS.md dosyasına yazıldı.

## 30 Ekim — ürün seçenekleri

18 Node/SQLite testi geçti. Yeni kontroller: serbest başlıkların kaydı, tekrarlanan/geçersiz şema, zorunlu alan ve metin sınırı, geçersiz seçim, sunucunun belirlediği birleşim fiyatı, aynı birleşimde toplam stok, atomik stok düşümü, idempotency, sipariş anındaki alan adları/değerleri, çoklu fotoğraf sınırı ve sahiplik. Tarayıcıda ürün düzenleme → varyasyon ekleme → ayrı fiyat/stok → özel metin alanı → kaydet → müşteri seçimi → sepet → demo siparişi akışı doğrulandı. Örnek İki kol 2290 TL ve Milo değeri siparişe doğru taşındı.

Temiz tarayıcıda ilk açılış ayrıca test edildi. Örnek sipariş verisi geçmiş kayıt gibi sabit fiyatla oluşturulur; yeni varyasyon seçimi beklemez. Boş localStorage ile demo başlangıcı ve kişiselleştirilmiş sipariş için regresyon testi eklendi.

## 30 Ekim — Etsy benzeri varyasyon yönetimi

21 test başarılı. Bağımsız fiyat/stok/SKU grupları ve grup stok havuzunu aşma denemeleri test edildi. Kapalı ayarlar ortak fiyat/stok/SKU'ya döner; varyasyonsuz ürün seçim istemez. Tarayıcıda beden/renk/konum kartları, konum türü ve tişört işaretleri, bağımsız kapsam seçimi, ürün kaydı, müşteri radyo kartı, sepette doğru fiyat ve demo siparişinde SKU doğrulandı.
