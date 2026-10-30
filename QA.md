# Doğrulama — 30 Ekim 2026

- 9/9 otomatik Node/SQLite testi başarılı: hesap/rol/oturum, giriş limiti, fiyat-kupon-kargo, toplam stok, idempotency/oturum sahipliği, son stok/rollback, snapshot, fotoğraf sahipliği/durum, kupon limiti.
- 16/16 yerel HTTP kontrolü başarılı: health, yetkisiz admin reddi, kaynak/özel dosyaların sunulmaması, admin girişi ve veri erişimi, yabancı origin reddi, özel fotoğraf yükleme/sahiplik, özel fotoğrafın public media yolundan okunamaması, ürün fotoğrafında admin zorunluluğu, ürün görseli yükleme/sunma, galeri kaydetme, çıkış ve oturum iptali.
- Tarayıcı: ürün kişiselleştirme → sepet → kupon → teslimat → demo siparişi → kaydın yönetim panelinde görünmesi. 1.890 TL ürün - %10 indirim + 99 TL kargo = 1.800 TL doğrulandı.
- Yönetim paneli, ürün listesi/düzenleyici ve mobil düzen görsel olarak kontrol edildi.
- Gerçek ödeme, kargo, e-posta, nakış dönüştürme ve üretim ortamı testi yapılmadı; bunlar bağlı değildir.
