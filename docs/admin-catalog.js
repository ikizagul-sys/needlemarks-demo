import { optionsEditor } from "./options-ui.js?v=add7483aa78d";
import { assignmentCount, categorySlug } from "./catalog-rules.js?v=add7483aa78d";

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
const uploadIcon = '<svg aria-hidden="true"><use href="#i-upload"/></svg>';

export function productEditor(product, categories, collections, demo) {
  return `<div class="catalog-editor">
    <div class="catalog-editor-heading"><div><button type="button" class="editor-back" data-admin-tab="products">← Ürünler</button><h1>${product.id ? "Ürünü düzenle" : "Yeni ürün"}</h1></div><span class="status-pill">${product.published ? "Yayında" : "Taslak"}</span></div>
    <form data-form="product-admin" data-id="${esc(product.id)}" class="simple-product-form">
      <div class="product-form-main">
        <section class="editor-card"><h2>Ürün bilgileri</h2>
          <label>Ürün adı <span class="required-mark">*</span><input name="name" value="${esc(product.name)}" required maxlength="140" placeholder="Örn. Kişiye özel nakışlı sweatshirt" autocomplete="off"></label>
          <div class="form-grid"><label>Fiyat (₺) <span class="required-mark">*</span><input name="price" type="number" value="${product.price ? product.price / 100 : ""}" min="0.01" max="1000000" step="0.01" required placeholder="0,00"></label><label>Stok adedi <span class="required-mark">*</span><input name="stock" type="number" value="${product.stock ?? 0}" min="0" max="100000" required></label></div>
          <label>Açıklama <span class="optional-label">İsteğe bağlı</span><textarea name="description" maxlength="3000" rows="3" placeholder="Müşterinin ürün hakkında bilmesi gerekenler…">${esc(product.description)}</textarea></label>
        </section>
        <section class="editor-card photo-card"><div class="editor-card-heading"><h2>Fotoğraflar</h2><span id="photoCount">0 / 8</span></div>
          <label class="cover-dropzone" data-product-dropzone data-upload-cover for="coverPhoto"><div id="coverPreview"></div><small>Dosya bırak veya galerideki bir görseli buraya sürükle · En fazla 5 MB</small></label><input class="visually-hidden" id="coverPhoto" type="file" accept="image/png,image/jpeg,image/webp"><label class="product-dropzone" data-product-dropzone for="productPhotos">${uploadIcon}<strong>Fotoğrafları buraya bırak</strong><span>veya <u>dosya seç</u></span><small>JPG, PNG veya WebP · Her biri en fazla 5 MB · Toplam 8 fotoğraf</small></label>
          <input class="visually-hidden" id="productPhotos" type="file" multiple accept="image/png,image/jpeg,image/webp">
          <div id="photoUploadStatus" class="photo-upload-status" role="status"></div><div id="editorGallery" class="editor-gallery"></div>
          <div class="photo-card-footer"><span>Vitrin görseli ilk sırada. Galeriden sürükleyerek veya tıklayarak değiştir.</span>${demo ? '<button type="button" class="subtle-link" data-action="sample-photo">Demo fotoğrafı kullan</button>' : ""}</div>
        </section>
        ${optionsEditor(product)}
        <details class="editor-card extra-product-info"><summary><span>Ek bilgiler</span><small>Malzeme ve bakım</small><span class="details-chevron">⌄</span></summary><div class="extra-product-fields"><label>Ortak ürün kodu (SKU)<input name="sku" value="${esc(product.sku || "")}" maxlength="80" placeholder="Örn. NM-TS-001"></label><label>Ortak hazırlık profili<input name="processingProfile" maxlength="120" value="${esc(product.processingProfile || "")}" placeholder="Örn. 3–5 iş günü"></label><label>Malzeme<input name="material" value="${esc(product.material)}" maxlength="600"></label><label>Bakım önerisi<input name="care" value="${esc(product.care)}" maxlength="600"></label></div></details>
      </div>
      <aside class="product-form-side"><section class="editor-card"><h2>Ürün düzeni</h2><label>Kategori <span class="required-mark">*</span><select name="category" required><option value="">Kategori seç</option>${categories.map((category) => `<option value="${esc(category.id)}" ${category.id === product.category ? "selected" : ""}>${esc(category.name)}</option>`).join("")}</select></label>
        <fieldset class="collection-choices"><legend>Koleksiyonlar <span class="optional-label">İsteğe bağlı</span></legend>${collections.length ? collections.map((collection) => `<label><input name="collections" type="checkbox" value="${esc(collection.id)}" ${product.collections?.includes(collection.id) ? "checked" : ""}><span>${esc(collection.name)}</span></label>`).join("") : "<p>Henüz koleksiyon eklenmedi.</p>"}</fieldset>
        <p class="organization-hint">Kategori ve koleksiyon adlarını sol menüdeki kendi bölümlerinden yönetebilirsin.</p></section>
      </aside>
      <div class="product-save-bar"><div data-error></div><span class="save-hint">Yayınladığın ürün mağazada görünür.</span><div><button type="submit" name="saveState" value="draft" class="button button-outline">Taslak kaydet</button><button type="submit" name="saveState" value="publish" class="button button-dark">${product.published ? "Değişiklikleri kaydet" : "Ürünü yayınla"}</button></div></div>
    </form></div>`;
}

export function taxonomyPage(type, data) {
  const category = type === "categories",
    title = category ? "Kategoriler" : "Koleksiyonlar",
    singular = category ? "kategori" : "koleksiyon";
  const records = data[type];
  if (category) return categoryCards(data);
  return `<div class="taxonomy-page"><div class="admin-title"><div><h2>${title}</h2><p>${category ? "Ürünlerini ana gruplara ayır." : "Bir arada sunmak istediğin ürünleri topla."}</p></div><button class="button button-dark" data-taxonomy-type="${type}" data-edit-taxonomy="new">+ ${category ? "Yeni kategori" : "Yeni koleksiyon"}</button></div>
    <section class="taxonomy-list"><div class="taxonomy-list-heading"><span>${category ? "Kategori adı" : "Koleksiyon adı"}</span><span>Ürün</span><span></span></div>${records
      .map((record) => {
        const count = assignmentCount(data.products, type, record.id);
        return `<div class="taxonomy-row"><div><span class="taxonomy-symbol">${category ? "▦" : "▧"}</span><strong>${esc(record.name)}</strong></div><span class="taxonomy-count">${count} ürün</span><div class="taxonomy-actions"><button data-taxonomy-type="${type}" data-edit-taxonomy="${esc(record.id)}">Düzenle</button>${count === 0 ? `<button class="taxonomy-remove" data-taxonomy-type="${type}" data-remove-taxonomy="${esc(record.id)}" aria-label="${esc(record.name)} ${singular} kaydını sil">Sil</button>` : ""}</div></div>`;
      })
      .join(
        "",
      )}${records.length ? "" : `<div class="taxonomy-empty"><h3>İlk ${singular} kaydını oluştur.</h3><p>Eklediğin adlar ürün formunda seçilebilir.</p></div>`}</section><p class="taxonomy-footnote">Ürün eklerken hazır listeden seç. Burada yaptığın ad değişiklikleri ürünlere de yansır.</p></div>`;
}

export function taxonomyEditor(type, record, products = []) {
  if (type === "categories") return categoryEditor(record, products);
  const singular = type === "categories" ? "kategori" : "koleksiyon";
  return `<div class="taxonomy-modal"><h2>${record ? "Adı düzenle" : `Yeni ${singular}`}</h2><form data-form="taxonomy" data-type="${type}" data-id="${esc(record?.id || "")}"><label>${type === "categories" ? "Kategori adı" : "Koleksiyon adı"}<input name="name" value="${esc(record?.name || "")}" required maxlength="80" placeholder="${type === "categories" ? "Örn. Çocuk ürünleri" : "Örn. Yeni sezon"}" autocomplete="off" autofocus></label><div data-error></div><div class="taxonomy-modal-actions"><button class="button button-outline" type="button" data-action="close-modal">Vazgeç</button><button class="button button-dark" type="submit">Kaydet</button></div></form></div>`;
}

export function categoryCover(record, products = []) {
  return (
    record?.image ||
    products.find((product) => product.category === record?.id && product.image)
      ?.image ||
    ""
  );
}
function categoryCards(data) {
  return `<div class="category-manager"><div class="admin-title category-page-title"><div><div class="eyebrow">KONTROL SENDE.</div><h2>Kategoriler</h2></div><button class="button button-dark" data-taxonomy-type="categories" data-edit-taxonomy="new"><span aria-hidden="true">＋</span> Yeni ekle</button></div><div data-category-note></div><section class="category-card-grid">${data.categories
    .map((record) => {
      const image = categoryCover(record, data.products),
        count = assignmentCount(data.products, "categories", record.id);
      return `<article class="category-card"><div class="category-card-photo">${image ? `<img src="${esc(image)}" alt="${esc(record.name)}" loading="lazy">` : '<div class="category-photo-placeholder"><svg aria-hidden="true"><use href="#i-upload"/></svg><span>Henüz fotoğraf eklenmedi</span></div>'}</div><div class="category-card-meta"><span class="category-visibility ${record.active === false ? "inactive" : "active"}">${record.active === false ? "Kategori pasif" : "Kategori aktif"}</span><span>${count} ürün</span></div><h3>${esc(record.name)}</h3><p class="category-card-slug">${esc(record.slug || categorySlug(record.name))}</p><div class="category-card-actions"><button class="button button-outline" data-taxonomy-type="categories" data-edit-taxonomy="${esc(record.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 4 5 5M3 21l5-1L21 7a2.8 2.8 0 0 0-4-4L4 16l-1 5Z"/></svg>Düzenle</button>${count === 0 ? `<button class="subtle-link category-card-delete" data-taxonomy-type="categories" data-remove-taxonomy="${esc(record.id)}">Sil</button>` : ""}</div></article>`;
    })
    .join(
      "",
    )}${data.categories.length ? "" : '<div class="taxonomy-empty"><h3>İlk kategorini ekle.</h3><p>Bir ad ve kapak fotoğrafıyla başlayabilirsin.</p></div>'}</section></div>`;
}
function categoryEditor(record, products) {
  const image = categoryCover(record, products);
  return `<div class="category-edit-modal"><h2>${record ? "Kategoriyi düzenle" : "Yeni kategori"}</h2><form data-form="taxonomy" data-type="categories" data-id="${esc(record?.id || "")}"><div class="category-edit-cover"><div id="categoryImagePreview">${image ? `<img src="${esc(image)}" alt="Kategori kapak fotoğrafı">` : "<span>Kapak fotoğrafı</span>"}</div><label class="button button-outline" for="categoryPhoto">${image ? "Fotoğrafı değiştir" : "Fotoğraf ekle"}</label><input class="visually-hidden" id="categoryPhoto" type="file" accept="image/jpeg,image/png,image/webp"><span id="categoryPhotoStatus" class="photo-upload-status" role="status"></span></div><label>Kategori adı<input name="name" id="categoryName" value="${esc(record?.name || "")}" required maxlength="80" placeholder="Örn. Çocuk ürünleri" autocomplete="off" autofocus></label><label>Bağlantı adı<input name="slug" id="categorySlug" value="${esc(record?.slug || categorySlug(record?.name))}" data-auto="${record ? "false" : "true"}" required maxlength="100" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="cocuk-urunleri"></label><label class="checkbox-line category-active-toggle"><input name="active" type="checkbox" ${record?.active === false ? "" : "checked"}> Mağazada göster</label><p class="field-hint">Pasif kategoriler mağaza menüsünde görünmez. Ürünler korunur.</p><div data-error></div><div class="taxonomy-modal-actions"><button class="button button-outline" type="button" data-action="close-modal">Vazgeç</button><button class="button button-dark" type="submit">Kaydet</button></div></form></div>`;
}
