import { categorySlug } from "./catalog-rules.js?v=196d1669caaa";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
const arrow = '<svg aria-hidden="true"><use href="#i-arrow"/></svg>';
const truck =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 5h12v13H2zM14 10h4l4 5v3h-8"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></svg>';
const box =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 9 5v10l-9 5-9-5V7l9-5Zm-9 5 9 5 9-5M12 12v10M7 4.8l9 5"/></svg>';
const shield =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 9 4v6c0 5-6 9-9 10-3-1-9-5-9-10V6l9-4Z"/><path d="m8 12 3 3 5-6"/></svg>';

export function siteFooter(settings, categories) {
  const link = (id) => `#/bilgi/${id}`,
    legal = settings.legalPages;
  return `<section class="service-notes" aria-label="Alışveriş bilgileri"><div>${truck}<span><strong>Özenli teslimat</strong><small>Kargo seçenekleri sepetinde</small></span></div><div>${box}<span><strong>Her detayında özen</strong><small>Her ilmekte senin hikâyen</small></span></div><div>${shield}<span><strong>Şeffaf alışveriş</strong><small>Örnek ürünlerle demo mağazası</small></span></div></section>
  <div class="footer-grid"><div class="footer-intro"><a href="#/" class="footer-wordmark">NEEDLEMARKS</a><p>Senin fotoğrafın. Senin hikâyen.<br>Her ilmekte sana ait bir iz.</p><a class="text-link" href="#/hikayemiz">Hikâyemiz ${arrow}</a></div><div class="footer-column"><h3>Keşfet</h3><a href="#/urunler">Tüm ürünler</a>${categories
    .filter((category) => category.active !== false)
    .map(
      (category) =>
        `<a href="#/kategori/${encodeURIComponent(category.slug || categorySlug(category.name))}">${esc(category.name)}</a>`,
    )
    .join(
      "",
    )}</div><div class="footer-column"><h3>Yanındayız</h3><a href="#/hesabim">Hesabım & siparişlerim</a><a href="#/iletisim">İletişim</a><a href="${link("kargo")}">${esc(legal.find((page) => page.id === "kargo").title)}</a><a href="${link("iade")}">${esc(legal.find((page) => page.id === "iade").title)}</a><a href="#/sss">Sıkça sorulan sorular</a><a href="#/admin">Yönetim paneli</a></div><div class="footer-column"><h3>Bilmen gerekenler</h3>${legal
    .filter((page) => !["kargo", "iade"].includes(page.id))
    .map((page) => `<a href="${link(page.id)}">${esc(page.title)}</a>`)
    .join("")}</div></div>
  <div class="footer-bottom"><span>© 2026 NEEDLEMARKS</span><span>Her ilmekte bir hikâye.</span><span>TRY ₺ · Türkçe</span></div><div class="footer-demo-note">Tasarım demosu · Ürünler örnektir · Gerçek ödeme alınmaz</div>`;
}

export function bannerEditor(banner) {
  return `<div class="admin-title"><div><h2>Bannerlar</h2><p>Ana sayfanın ilk karşılaşmasını düzenle.</p></div></div><form data-form="banner" class="content-editor-grid"><section class="editor-card"><h2>Karşılama alanı</h2><label>Başlık<textarea name="title" required maxlength="180" rows="3">${esc(banner.title)}</textarea></label><label>Açıklama<textarea name="description" maxlength="800" rows="3">${esc(banner.description)}</textarea></label><label>Buton yazısı<input name="buttonText" required maxlength="80" value="${esc(banner.buttonText)}"></label><label>Butonun açacağı sayfa<select name="buttonLink"><option value="#/urunler" ${banner.buttonLink === "#/urunler" ? "selected" : ""}>Tüm ürünler</option><option value="#/nasil-calisir" ${banner.buttonLink === "#/nasil-calisir" ? "selected" : ""}>Nasıl çalışır?</option><option value="#/hikayemiz" ${banner.buttonLink === "#/hikayemiz" ? "selected" : ""}>Hikâyemiz</option></select></label><label class="checkbox-line"><input name="visible" type="checkbox" ${banner.visible ? "checked" : ""}> Ana sayfada göster</label><div data-error></div><button type="submit" class="button button-dark">Bannerı kaydet</button></section><section class="editor-card banner-photo-card"><h2>Görsel</h2><img id="bannerImagePreview" src="${esc(banner.image)}" alt="Banner görseli"><label class="button button-outline" for="bannerPhoto">Görsel değiştir</label><input class="visually-hidden" type="file" id="bannerPhoto" accept="image/jpeg,image/png,image/webp"><div class="photo-upload-status" id="bannerPhotoStatus" role="status"></div><p>Seçtiğin görsel ana sayfada kullanılır.</p></section></form>`;
}

export function legalEditor(pages, selected) {
  const page = pages.find((page) => page.id === selected) || pages[0];
  return `<div class="admin-title"><div><h2>Yasal metinler</h2><p>Alt menüdeki bilgi sayfalarını buradan düzenle.</p></div><a class="text-link" href="#/bilgi/${page.id}">Sayfayı görüntüle ↗</a></div><div class="legal-editor-layout"><nav aria-label="Bilgi sayfaları">${pages.map((item) => `<button class="${item.id === page.id ? "selected" : ""}" data-legal-page="${item.id}">${esc(item.title)}</button>`).join("")}</nav><form data-form="legal" data-id="${page.id}" class="editor-card"><label>Sayfa başlığı<input name="title" required maxlength="100" value="${esc(page.title)}"></label><label>Sayfa metni<textarea name="body" rows="16" maxlength="20000">${esc(page.body)}</textarea></label><p class="field-hint">Başlangıç metinleri taslaktır. Gerçek mağazada onaylanmış metinlerini kullan.</p><div data-error></div><button class="button button-dark" type="submit">Metni kaydet</button></form></div>`;
}

export function legalBody(page) {
  return `<article class="information-page"><p class="information-draft">NEEDLEMARKS · Bilgi sayfası</p><div class="information-text">${esc(page.body)}</div><a class="text-link" href="#/iletisim">Bir sorum var ${arrow}</a></article>`;
}
