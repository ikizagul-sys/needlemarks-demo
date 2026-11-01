import { variantPhotos } from "./variation-media.js";
import { validatePhoto, moveToCover } from "./demo-storage.js";
import {
  renderOptions,
  syncVariationImages,
  variationInput,
  variationDrag,
  readOptions,
  optionAction,
  saveOption,
  optionChange,
  saveManager,
  showVariationManager,
  customerOptions,
  selectionsHTML,
} from "./options-ui.js";
import {
  fieldsFor,
  resolveOptions,
  selectedVariant,
  matchingVariants,
} from "./product-options.js";
import { categorySlug } from "./catalog-rules.js";
import {
  siteFooter,
  bannerEditor,
  legalEditor,
  legalBody,
} from "./store-content.js";
import {
  productEditor,
  taxonomyPage,
  taxonomyEditor,
  categoryCover,
} from "./admin-catalog.js";
import * as S from "./data.js";
let detailGallery = { images: [], index: 0 };
const $ = (s, r = document) => r.querySelector(s),
  $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icon = (n) => `<svg aria-hidden="true"><use href="#i-${n}"/></svg>`;
const money = (v) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(v / 100);
const date = (v) => new Date(v).toLocaleDateString("tr-TR");
const cats = () => ({
  all: "Tüm parçalar",
  ...Object.fromEntries(
    S.catalog.categories
      .filter((category) => category.active !== false)
      .map((category) => [category.id, category.name]),
  ),
});
const statuses = {
  "demo-received": "Demo alındı",
  designing: "Tasarım hazırlanıyor",
  production: "Üretimde",
  shipped: "Kargoya verildi",
  completed: "Tamamlandı",
};
const main = $("main"),
  home = main.innerHTML;
let filters = {
    category: "all",
    search: "",
    max: "",
    size: "",
    sort: "featured",
  },
  coupon = "",
  adminTab = "overview",
  adminData,
  orderKey = S.uid(),
  preview,
  timer,
  editorImages = [];
const go = (p) => (location.hash = "#/" + p);
function toast(msg) {
  clearTimeout(timer);
  $("#toast").textContent = msg;
  $("#toast").classList.add("visible");
  timer = setTimeout(() => $("#toast").classList.remove("visible"), 3500);
}
function notice() {
  return `<div class="mode-note">${S.mode === "demo" ? "GitHub demosu · Değişiklikler yalnızca bu tarayıcıda saklanır. Örnek bilgiler kullan." : "Yerel mağaza · Kayıtlar yerel veritabanında saklanır."} Gerçek ödeme alınmaz.</div>`;
}
function heading(title, kicker = "NEEDLEMARKS", description = "") {
  return `<section class="page-heading"><nav class="breadcrumbs"><a href="#/">Ana sayfa</a><span>/</span><span>${esc(title.replace(/<[^>]*>/g, ""))}</span></nav><div class="eyebrow">${kicker}</div><h1>${title}</h1>${description ? `<p>${description}</p>` : ""}</section>`;
}
function field(label, name, value = "", type = "text", extra = "") {
  return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
}
function errorHTML(err) {
  return `<div class="inline-error" role="alert">${esc(err.message || err)}</div>`;
}
function header() {
  $("#cartCount").textContent = S.cart.reduce((s, i) => s + i.quantity, 0);
  $(".announcement>span").textContent = S.catalog.settings.announcement;
  $("footer").innerHTML = siteFooter(S.catalog.settings, S.catalog.categories);
  $("#modeLabel").textContent =
    S.mode === "demo" ? "TASARIM DEMOSU" : "YEREL MAĞAZA · TEST";
}
function card(p) {
  return `<article class="product-card"><div class="product-image-wrap"><a class="product-link" href="#/urun/${encodeURIComponent(p.id)}"><img src="${esc(p.image)}" alt="${esc(p.kind)}" loading="lazy" width="450" height="560"></a><span class="product-badge">${p.stock ? esc(p.badge || "SANA ÖZEL") : "TÜKENDİ"}</span><button class="favorite-button icon-button ${S.favorites.includes(p.id) ? "saved" : ""}" data-favorite="${esc(p.id)}" aria-label="${esc(p.kind)} favori durumunu değiştir" aria-pressed="${S.favorites.includes(p.id)}">${icon("heart")}</button><a class="quick-add" href="#/urun/${encodeURIComponent(p.id)}">Kişiselleştir ${icon("arrow")}</a></div><div class="product-info"><div class="product-category">${esc(p.kind)}</div><a class="product-title" href="#/urun/${encodeURIComponent(p.id)}">${esc(p.name)}</a><div class="product-bottom"><span class="product-price">${money(p.price)}</span><div class="swatches">${(p.swatches || []).map((c) => `<span class="swatch" style="background:${/^#[a-fA-F0-9]{6}$/.test(c) ? c : "#d8cfb9"}"></span>`).join("")}</div></div></div></article>`;
}
function grid(favorite = false) {
  let list = S.catalog.products.filter(
    (p) =>
      p.published &&
      (!filters.collection || p.collections?.includes(filters.collection)) &&
      (!favorite || S.favorites.includes(p.id)) &&
      (filters.category === "all" || p.category === filters.category) &&
      (!filters.search ||
        `${p.name} ${p.kind} ${p.type}`
          .toLocaleLowerCase("tr")
          .includes(filters.search.toLocaleLowerCase("tr"))) &&
      (!filters.max || p.price <= Number(filters.max) * 100) &&
      (!filters.size || p.sizes.includes(filters.size)),
  );
  if (filters.sort === "price-asc") list.sort((a, b) => a.price - b.price);
  if (filters.sort === "price-desc") list.sort((a, b) => b.price - a.price);
  $("#productGrid").innerHTML = list.map(card).join("");
  $("#resultsCount").textContent = `${list.length} özel parça`;
  $("#emptyResults").hidden = Boolean(list.length);
}
function catalogPage(favorite = false) {
  main.innerHTML =
    heading(
      favorite
        ? "Kalbine <em>yakın olanlar.</em>"
        : "Bir parçadan <em>fazlası.</em>",
      favorite ? "FAVORİLERİN" : "SENİN KADAR BENZERSİZ",
      "Hikâyene eşlik edecek parçayı keşfet. Her tasarım senin fotoğrafınla başlar.",
    ) +
    `<section class="catalog-layout"><aside class="filter-sidebar"><form data-form="filters"><h3>Parçanı bul</h3>${field("Ürün ara", "search", filters.search, "search", 'placeholder="Sweatshirt, şapka…"')}<fieldset><legend>Kategori</legend>${Object.entries(
      cats(),
    )
      .map(
        ([k, n]) =>
          `<label class="radio-line"><input type="radio" name="category" value="${k}" ${k === filters.category ? "checked" : ""}>${esc(n)}</label>`,
      )
      .join(
        "",
      )}</fieldset><label>Koleksiyon<select name="collection"><option value="">Tüm koleksiyonlar</option>${S.catalog.collections.map((item) => `<option value="${esc(item.id)}" ${filters.collection === item.id ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select></label>${field("En yüksek fiyat (₺)", "max", filters.max, "number", 'min="0" step="1" placeholder="Sınır yok"')}<label>Beden<select name="size"><option value="">Tüm bedenler</option>${["S", "M", "L", "XL", "Standart", "Ayarlanabilir"].map((s) => `<option ${s === filters.size ? "selected" : ""}>${s}</option>`).join("")}</select></label><label>Sıralama<select name="sort"><option value="featured">Öne çıkanlar</option><option value="price-asc" ${filters.sort === "price-asc" ? "selected" : ""}>Fiyat: artan</option><option value="price-desc" ${filters.sort === "price-desc" ? "selected" : ""}>Fiyat: azalan</option></select></label><button class="button button-dark">Filtreleri uygula</button><button type="button" class="text-link" data-action="reset-filters">Temizle</button></form><div class="filter-note">Bir fotoğraf.<br>Bir his.<br><em>Sadece sana ait.</em></div></aside><div class="catalog-results"><div class="results-line"><span id="resultsCount"></span><span>Her tasarım fotoğrafınla başlar.</span></div><div class="product-grid" id="productGrid"></div><div class="empty-results" id="emptyResults" hidden><h3>Burada henüz bir hikâye yok.</h3><p>Başka filtreler veya yeni favoriler dene.</p><button class="text-link" data-action="reset-filters">Tüm parçaları göster →</button></div><p class="catalog-note">Örnek ürünler ve temsilî fiyatlar. Görseller bu demo için üretilmiştir.</p></div></section>`;
  grid(favorite);
}
function detailPage(id) {
  const p = S.catalog.products.find((p) => p.id === id && p.published);
  if (!p) return notFound();
  main.innerHTML = `<section class="product-detail"><nav class="breadcrumbs"><a href="#/">Ana sayfa</a><span>/</span><a href="#/urunler">Koleksiyon</a><span>/</span><span>${esc(p.kind)}</span></nav><div class="detail-columns"><div><div class="detail-image" tabindex="0" role="region" aria-label="Ürün fotoğraf galerisi"><button type="button" class="gallery-arrow previous" data-gallery-step="-1" aria-label="Önceki fotoğraf">‹</button><button type="button" class="gallery-arrow next" data-gallery-step="1" aria-label="Sonraki fotoğraf">›</button><span id="galleryCounter" class="gallery-counter" aria-live="polite"></span><img id="detailMainImage" src="${esc(p.image)}" alt="${esc(p.kind)}"><span class="product-badge">${esc(p.badge || "SANA ÖZEL")}</span></div><div class="gallery-thumbs" id="detailThumbs">${(p.images || [p.image]).map((image, i) => `<button data-gallery="${i}" data-product-id="${esc(p.id)}" aria-label="Ürün görseli ${i + 1}"><img src="${esc(image)}" alt=""></button>`).join("")}</div><p class="catalog-note">Örnek görsel. Fotoğrafı bağlı seçeneklerde galeri seçimine göre değişir.</p></div><div class="detail-copy"><div class="eyebrow">${esc(p.kind.toLocaleUpperCase("tr"))}</div><h1>${esc(p.name)}</h1><div class="detail-price">${money(p.price)} <span>${p.stock ? "Kişiye özel hazırlanır" : "Şu an tükendi"}</span></div><p>${esc(p.description)}</p><form data-form="add-product" data-id="${esc(p.id)}">${[
    ["color", "01 · Rengini seç", p.managedVariations ? [] : p.colors],
    ["size", "02 · Bedenini seç", p.managedVariations ? [] : p.sizes],
  ]
    .filter(([, , options]) => options.length)
    .map(
      ([n, t, a]) =>
        `<fieldset><legend>${t}${n === "size" ? '<button type="button" class="subtle-link" data-action="size-guide">Beden rehberi</button>' : ""}</legend><div class="choice-row">${a.map((v, i) => `<label><input name="${n}" type="radio" value="${esc(v)}" ${i === 0 ? "checked" : ""}><span>${esc(v)}</span></label>`).join("")}</div></fieldset>`,
    )
    .join(
      "",
    )}${customerOptions(p)}<div class="detail-purchase">${field("Adet", "quantity", 1, "number", `min="1" max="${Math.min(p.stock, 20) || 1}" required`)}<button class="button button-dark" ${p.stock ? "" : "disabled"}>${p.stock ? "Hikâyeme ekle" : "Tükendi"} ${icon("bag")}</button></div><div data-error></div><p class="field-hint" id="detailProcessing">Örnek hazırlık: ${esc(S.catalog.settings.preparationDays)}. Demo siparişi üretime gönderilmez.</p></form><div class="product-accordions"><details open><summary>Ürün ve malzeme</summary><p>${esc(p.material)}</p></details><details><summary>Bakım önerileri</summary><p>${esc(p.care)}</p></details><details><summary>Teslimat ve kişiselleştirme</summary><p>Örnek kargo ücreti ${money(S.catalog.settings.shippingFee)}. İndirim sonrası ${money(S.catalog.settings.freeShippingThreshold)} ve üzeri sepette ücretsiz kargo hesaplanır.</p></details></div></div></div></section><section class="section-pad related-products"><div class="eyebrow">HİKÂYENE EŞLİK EDEBİLİR</div><h2>Bir de <em>bunlara bak.</em></h2><div class="product-grid">${S.catalog.products
    .filter((x) => x.published && x.id !== p.id)
    .map(card)
    .join("")}</div></section>`;
  setDetailGallery(p, {});
  updateDetailChoices(p);
}
function itemPrice(p, item) {
  try {
    return selectedVariant(p, item.selections).price;
  } catch {
    return p.price;
  }
}
function cartRows() {
  return S.cart
    .map((i) => {
      const p = S.catalog.products.find((p) => p.id === i.id);
      if (!p)
        return `<div class="cart-row">Ürün artık mevcut değil.<button data-remove="${esc(i.key)}">Kaldır</button></div>`;
      return `<article class="cart-row"><a href="#/urun/${encodeURIComponent(p.id)}"><img src="${esc(i.image || p.image)}" alt="${esc(p.kind)}"></a><div><span class="product-category">${esc(p.kind)}</span><a href="#/urun/${encodeURIComponent(p.id)}"><h3>${esc(p.name)}</h3></a>${!i.managedVariations ? `<p>${esc(i.color)} · ${esc(i.size)}</p>` : ""}${selectionsHTML(i)}${i.sku ? `<small>Ürün kodu: ${esc(i.sku)}</small>` : ""}${i.processingProfile ? `<small>Hazırlık: ${esc(i.processingProfile)}</small>` : ""}${!i.optionAnswers && i.note ? `<p>Not: ${esc(i.note)}</p>` : ""}${i.photoSelected ? "<p>Fotoğraf seçildi · Demo kişiselleştirme</p>" : ""}<button class="remove-item" data-remove="${esc(i.key)}">Kaldır</button></div><div class="cart-row-total"><strong>${money(itemPrice(p, i) * i.quantity)}</strong><div class="quantity"><button data-quantity="${esc(i.key)}" data-change="-1" aria-label="${esc(p.kind)} adedini azalt">−</button><span>${i.quantity}</span><button data-quantity="${esc(i.key)}" data-change="1" aria-label="${esc(p.kind)} adedini artır">+</button></div></div></article>`;
    })
    .join("");
}
async function totals() {
  try {
    const q = await S.quote(coupon);
    return `<div class="total-line"><span>Ürünler</span><span>${money(q.subtotal)}</span></div>${q.discount ? `<div class="total-line discount"><span>${esc(q.coupon)} indirimi</span><span>−${money(q.discount)}</span></div>` : ""}<div class="total-line"><span>Kargo</span><span>${q.shipping ? money(q.shipping) : "Ücretsiz"}</span></div><div class="total-line grand-total"><strong>Toplam</strong><strong>${money(q.total)}</strong></div>`;
  } catch (err) {
    return errorHTML(err);
  }
}
async function cartPage() {
  main.innerHTML =
    heading("Hikâyene <em>eklediklerin.</em>", "SEPETİN") +
    notice() +
    (!S.cart.length
      ? `<section class="empty-state">${icon("bag")}<h2>Yeni bir hikâyeye yer var.</h2><p>Henüz bir parça seçmedin.</p><a class="button button-dark" href="#/urunler">Koleksiyonu keşfet ${icon("arrow")}</a></section>`
      : `<section class="cart-layout"><div>${cartRows()}<a class="text-link" href="#/urunler">← Alışverişe devam et</a></div><aside class="order-summary"><div class="eyebrow">SİPARİŞ ÖZETİN</div><h3>Her detay, sana özel.</h3><form data-form="coupon" class="coupon-form"><label for="coupon">Kupon kodun var mı?</label><div><input id="coupon" name="coupon" value="${esc(coupon)}" placeholder="ILKILMEK10"><button>Uygula</button></div><p>Örnek: ILKILMEK10 · ${money(150000)} üzeri %10</p></form>${await totals()}<a class="button button-dark" href="#/odeme">Teslimat bilgilerine geç ${icon("arrow")}</a><p class="field-hint">Gerçek ödeme alınmaz. Sonraki adım demo siparişidir.</p></aside></section>`);
}
const cities =
  "Adana,Adıyaman,Afyonkarahisar,Ağrı,Amasya,Ankara,Antalya,Artvin,Aydın,Balıkesir,Bilecik,Bingöl,Bitlis,Bolu,Burdur,Bursa,Çanakkale,Çankırı,Çorum,Denizli,Diyarbakır,Edirne,Elazığ,Erzincan,Erzurum,Eskişehir,Gaziantep,Giresun,Gümüşhane,Hakkari,Hatay,Isparta,Mersin,İstanbul,İzmir,Kars,Kastamonu,Kayseri,Kırklareli,Kırşehir,Kocaeli,Konya,Kütahya,Malatya,Manisa,Kahramanmaraş,Mardin,Muğla,Muş,Nevşehir,Niğde,Ordu,Rize,Sakarya,Samsun,Siirt,Sinop,Sivas,Tekirdağ,Tokat,Trabzon,Tunceli,Şanlıurfa,Uşak,Van,Yozgat,Zonguldak,Aksaray,Bayburt,Karaman,Kırıkkale,Batman,Şırnak,Bartın,Ardahan,Iğdır,Yalova,Karabük,Kilis,Osmaniye,Düzce"
    .split(",")
    .sort((a, b) => a.localeCompare(b, "tr"));
async function checkoutPage() {
  if (!S.cart.length) return cartPage();
  main.innerHTML =
    heading("Son bir <em>küçük adım.</em>", "DEMO TESLİMAT BİLGİLERİ") +
    notice() +
    `<section class="checkout-layout"><form data-form="checkout" class="surface-form"><div class="checkout-steps"><span>01 Sepet</span><span class="current">02 Teslimat</span><span>03 Demo onayı</span></div><h2>Hikâyen nereye gelsin?</h2><p class="field-hint">Bu bir demo. Gerçek kişisel bilgiler yerine örnek bilgiler kullanabilirsin.</p><div class="form-grid">${field("Ad soyad", "name", S.user?.name || "", "text", 'required minlength="3" maxlength="100" placeholder="Deniz Örnek"')}${field("E-posta", "email", S.user?.email || "", "email", 'required maxlength="160" placeholder="deniz@example.com"')}${field("Telefon", "phone", "", "tel", 'required minlength="10" maxlength="30" placeholder="0555 000 00 00"')}<label>İl<select name="city" required><option value="">İl seç</option>${cities.map((c) => `<option>${c}</option>`).join("")}</select></label>${field("İlçe", "district", "", "text", 'required minlength="2" maxlength="80" placeholder="Örnek ilçe"')}${field("Posta kodu (isteğe bağlı)", "postalCode", "", "text", 'pattern="[0-9]{5}" maxlength="5" placeholder="34000"')}<label class="full-width">Açık adres<textarea name="address" required minlength="10" maxlength="400" placeholder="Örnek mahalle, sokak, bina ve daire"></textarea></label></div><label class="checkbox-line"><input name="consent" type="checkbox" required> Bunun gerçek ödeme veya gönderim oluşturmayan bir demo siparişi olduğunu anladım.</label><div data-error></div><button class="button button-dark">Demo siparişini oluştur ${icon("arrow")}</button><p class="field-hint">Kart bilgisi istenmez. Vergi faturası veya kargo kaydı oluşturulmaz.</p></form><aside class="order-summary"><div class="eyebrow">SEÇTİĞİN PARÇALAR</div>${S.cart
      .map((i) => {
        const p = S.catalog.products.find((p) => p.id === i.id);
        return `<div class="checkout-item"><img src="${esc(p.image)}" alt=""><div>${esc(p.kind)}<small>${i.managedVariations ? "" : esc(i.color) + " · " + esc(i.size) + " · "}${i.quantity} adet</small>${selectionsHTML(i)}${i.sku ? `<small>Ürün kodu: ${esc(i.sku)}</small>` : ""}${i.processingProfile ? `<small>Hazırlık: ${esc(i.processingProfile)}</small>` : ""}</div><span>${money(itemPrice(p, i) * i.quantity)}</span></div>`;
      })
      .join("")}${await totals()}</aside></section>`;
}
async function orderPage(id) {
  const o = (await S.getOrders()).find((o) => o.id === id || o.number === id);
  if (!o) return notFound("Sipariş bu oturumda bulunamadı.");
  const index = Object.keys(statuses).indexOf(o.status);
  main.innerHTML =
    heading("Bir hikâye <em>daha başladı.</em>", "DEMO SİPARİŞİN") +
    notice() +
    `<section class="order-detail"><div class="order-confirm"><span class="checkout-icon">${icon("check")}</span><h2>${esc(o.number)}</h2><p>${date(o.createdAt)} · ${esc(statuses[o.status])}</p><div class="order-timeline">${Object.entries(
      statuses,
    )
      .map(
        ([key, name], i) =>
          `<span class="${i <= index ? "reached" : ""}"><i></i>${name}</span>`,
      )
      .join(
        "",
      )}</div></div><div class="order-detail-grid"><div class="surface"><h3>Seçtiğin parçalar</h3>${o.items.map((i) => `<div class="checkout-item"><img src="${esc(i.image)}" alt=""><div>${esc(i.kind)}<small>${i.managedVariations ? "" : esc(i.color) + " · " + esc(i.size) + " · "}${i.quantity} adet</small>${selectionsHTML(i)}${i.sku ? `<small>Ürün kodu: ${esc(i.sku)}</small>` : ""}${i.processingProfile ? `<small>Hazırlık: ${esc(i.processingProfile)}</small>` : ""}${!i.optionAnswers && i.note ? `<small>${esc(i.note)}</small>` : ""}${i.uploadId && S.mode === "server" ? `<a class="subtle-link" href="./api/uploads/${encodeURIComponent(i.uploadId)}" target="_blank" rel="noopener">Fotoğrafı görüntüle</a>` : ""}</div><span>${money(i.price * i.quantity)}</span></div>`).join("")}<div class="total-line grand-total"><strong>Demo toplam</strong><strong>${money(o.total)}</strong></div></div><div class="surface"><h3>Teslimat bilgileri</h3><p>${esc(o.customer.name)}<br>${esc(o.customer.address)}<br>${esc(o.customer.district)} / ${esc(o.customer.city)}</p><p>${esc(o.customer.email)}<br>${esc(o.customer.phone)}</p><p class="field-hint">Tahsilat, gerçek üretim ve kargo başlatılmadı.</p></div></div><a href="#/urunler" class="text-link">Yeni hikâyeler keşfet ${icon("arrow")}</a></section>`;
}
async function accountPage() {
  if (!S.user) return authPage();
  const list = await S.getOrders();
  main.innerHTML =
    heading(`Merhaba, <em>${esc(S.user.name.split(" ")[0])}.</em>`, "HESABIM") +
    notice() +
    `<section class="account-layout"><aside class="account-sidebar"><div class="avatar">${esc(S.user.name.slice(0, 1))}</div><strong>${esc(S.user.name)}</strong><p>${esc(S.user.email)}</p><a href="#/hesabim">Siparişlerim</a><a href="#/favoriler">Favorilerim</a>${S.user.role === "admin" ? '<a href="#/admin">Yönetim paneli</a>' : ""}<button data-action="logout">Çıkış yap</button></aside><div><h2>Sipariş hikâyelerin</h2>${list.length ? list.map((o) => `<a class="order-list-row" href="#/siparis/${encodeURIComponent(o.id)}"><div><strong>${esc(o.number)}</strong><small>${date(o.createdAt)} · ${o.items.reduce((s, i) => s + i.quantity, 0)} parça</small></div><span class="status-pill">${esc(statuses[o.status])}</span><strong>${money(o.total)}</strong>${icon("arrow")}</a>`).join("") : '<div class="empty-state"><h3>İlk hikâyen seni bekliyor.</h3><p>Demo siparişlerin burada görünür.</p><a href="#/urunler" class="button button-dark">Koleksiyonu keşfet</a></div>'}</div></section>`;
}
function authPage(admin = false, register = false) {
  main.innerHTML =
    heading(
      admin
        ? "Atölyenin <em>kontrolü sende.</em>"
        : register
          ? "Hikâyemize <em>katıl.</em>"
          : "Yeniden <em>merhaba.</em>",
      admin ? "YÖNETİCİ GİRİŞİ" : "HESABIM",
    ) +
    `<section class="auth-layout"><div class="auth-story"><img src="assets/${admin ? "sweatshirt" : "tote"}.webp" alt="NEEDLEMARKS koleksiyonu"><span>Her ilmekte bir hikâye.</span></div><div class="auth-form">${notice()}${S.mode === "demo" ? `<h2>${admin ? "Demo yönetim paneli" : "Örnek müşteri hesabı"}</h2><p>Bu bağlantı herkese açık bir önizlemedir. Gerçek kullanıcı hesabı veya parola oluşturulmaz.</p><button class="button button-dark" data-action="${admin ? "demo-admin" : "demo-login"}">${admin ? "Demo paneli aç" : "Örnek hesapla devam et"} ${icon("arrow")}</button>` : `<form data-form="${register ? "register" : "login"}" data-admin="${admin}"><h2>${register ? "Hesap oluştur" : admin ? "Yönetici girişi" : "Hesabına giriş yap"}</h2>${register ? field("Ad soyad", "name", "", "text", 'required minlength="2" maxlength="100"') : ""}${field("E-posta", "email", "", "email", 'required autocomplete="username"')}${field("Parola", "password", "", "password", `required ${register ? 'minlength="12"' : ""} maxlength="128" autocomplete="${register ? "new-password" : "current-password"}"`)}${admin ? '<p class="field-hint">İlk yönetici bilgileri yalnızca yerel .local/admin-access.json dosyasındadır.</p>' : ""}<div data-error></div><button class="button button-dark">${register ? "Hesap oluştur" : "Giriş yap"}</button>${!admin ? `<button class="text-link" type="button" data-action="${register ? "show-login" : "show-register"}">${register ? "Giriş yap" : "Hesap oluştur"}</button>` : ""}</form>`}</div></section>`;
}

function contentPage(page) {
  const entries = {
    hikayemiz: [
      "Her ilmekte <em>bir hikâye.</em>",
      "NEEDLEMARKS DÜNYASI",
      `<div class="editorial-split"><img src="assets/hero.webp" alt="Kişiye özel nakış detayı"><div><h2>Bir fotoğraftan, bir bağa.</h2><p>${esc(S.catalog.settings.about)}</p><p>Bazen tek bir kareye koca bir dünya sığar. Birlikte büyüdüğün dostun, ilk buluşmanız veya dönüp dönüp baktığın o an…</p><p>Bu tasarım demosunda kişiselleştirmenin nasıl hissettireceğini keşfedebilirsin. Marka metinleri ve ürünler örnektir.</p><a class="text-link" href="#/urunler">Senin hikâyen hangisi? ${icon("arrow")}</a></div></div>`,
    ],
    "nasil-calisir": [
      "Anından <em>üzerine.</em>",
      "SANA ÖZEL BİR YOLCULUK",
      `<div class="journey-grid">${[
        [
          "01",
          "Parçanı seç.",
          "Koleksiyondan bir ürün seç; rengini ve bedenini belirle.",
        ],
        [
          "02",
          "Anını paylaş.",
          "Net ve aydınlık bir fotoğraf yükle. İsim, tarih veya küçük bir not ekle.",
        ],
        [
          "03",
          "Hikâyeni tamamla.",
          "Sepetini kontrol et, örnek teslimat bilgilerini doldur ve demo siparişini oluştur.",
        ],
        [
          "04",
          "Süreci keşfet.",
          "Sipariş durumunu hesabında ve yönetim panelinde incele. Gerçek üretim başlatılmaz.",
        ],
      ]
        .map(
          ([n, t, d]) =>
            `<article><span class="step-number">${n}</span><h2>${t}</h2><p>${d}</p></article>`,
        )
        .join("")}</div>`,
    ],
    iletisim: [
      "Bir <em>merhaba de.</em>",
      "İLETİŞİM",
      `<div class="contact-grid"><div><h2>Birlikte güzel şeyler yapalım.</h2><p>Ürünler, fotoğraf seçimi veya kişiselleştirme hakkında aklına takılanlar için buradayız.</p><p class="field-hint">İletişim bilgileri henüz marka tarafından sağlanmadı. Bu form e-posta göndermez; yalnızca deneyimi gösterir.</p><a class="text-link" href="#/sss">Sıkça sorulan sorular ${icon("arrow")}</a></div><form data-form="contact" class="surface-form">${field("Adın", "name", "", "text", 'required maxlength="100" placeholder="Deniz Örnek"')}${field("E-posta", "email", "", "email", 'required placeholder="deniz@example.com"')}<label>Mesajın<textarea name="message" required minlength="10" maxlength="2000" placeholder="Seni dinliyoruz…"></textarea></label><button class="button button-dark">Demo formunu tamamla</button><div data-error></div></form></div>`,
    ],
    sss: [
      "Küçük <em>meraklar.</em>",
      "SIKÇA SORULAN SORULAR",
      `<div class="faq-list faq-page">${[
        [
          "Nasıl bir fotoğraf seçmeliyim?",
          "Nakışını istediğin yüzün veya detayın net göründüğü, aydınlık bir fotoğraf seç.",
        ],
        [
          "Fotoğrafım otomatik nakışa dönüşüyor mu?",
          "Bu demoda fotoğraf önizlemesi var; otomatik nakış dönüştürme veya gerçek üretim onayı yok.",
        ],
        [
          "GitHub demosundaki bilgiler kalıcı mı?",
          "Değişiklikler sadece aynı tarayıcının yerel depolamasında kalır. Başka bir cihaz bunları görmez. Yerel sunucu sürümünde veritabanına kaydedilir.",
        ],
        [
          "Gerçek sipariş veya ödeme var mı?",
          "Kart bilgisi istenmez. Siparişler demo olarak işaretlenir ve üretime gönderilmez.",
        ],
        [
          "Hazırlık, kargo ve iade koşulları nedir?",
          "Gösterilen süreler ve kargo ücretleri örnektir. Gerçek ticari koşullar marka tarafından sağlanmalıdır. Demo satış sözleşmesi oluşturmaz.",
        ],
        [
          "Fotoğrafım nerede tutuluyor?",
          "GitHub demosunda yalnızca açık tarayıcı oturumunda önizlenir. Yerel sunucuda .local/uploads içine kaydedilir; ilgili oturum ve yönetici erişebilir.",
        ],
      ]
        .map(
          ([q, a]) =>
            `<details><summary>${q}<span>+</span></summary><p>${a}</p></details>`,
        )
        .join("")}</div>`,
    ],
    "siparis-takip": [
      "Hikâyen <em>hangi aşamada?</em>",
      "SİPARİŞ TAKİBİ",
      `<div class="tracking-form"><p>Sipariş numaranla bu oturumdaki demo siparişini bulabilirsin. Üye siparişleri hesabında da görünür.</p><form data-form="tracking">${field("Sipariş numarası", "number", "", "text", 'required placeholder="NM-DEMO-…"')}<button class="button button-dark">Siparişimi bul</button><div data-error></div></form></div>`,
    ],
  };
  const item = entries[page];
  if (!item) return notFound();
  main.innerHTML =
    heading(item[0], item[1]) +
    `<section class="content-section">${item[2]}</section>`;
}
const adminTabs = {
  overview: "Genel bakış",
  products: "Ürünler",
  collections: "Koleksiyonlar",
  categories: "Kategoriler",
  orders: "Siparişler",
  customers: "Müşteriler",
  coupons: "Kuponlar",
  banners: "Bannerlar",
  settings: "Kargo & duyuru",
  legal: "Yasal metinler",
};
function orderTable(list, editable = false) {
  return `<div class="table-scroll"><table><thead><tr><th>Sipariş</th><th>Müşteri</th><th>Tutar</th><th>Durum</th><th></th></tr></thead><tbody>${list
    .map(
      (o) =>
        `<tr><td><strong>${esc(o.number)}</strong><small>${date(o.createdAt)}</small></td><td>${esc(o.customer.name)}</td><td>${money(o.total)}</td><td>${
          editable
            ? `<select data-order-status="${esc(o.id)}" aria-label="${esc(o.number)} sipariş durumu">${Object.entries(
                statuses,
              )
                .map(
                  ([k, n]) =>
                    `<option value="${k}" ${k === o.status ? "selected" : ""}>${n}</option>`,
                )
                .join("")}</select>`
            : `<span class="status-pill">${esc(statuses[o.status])}</span>`
        }</td><td><a class="subtle-link" href="#/siparis/${encodeURIComponent(o.id)}">İncele</a></td></tr>`,
    )
    .join(
      "",
    )}</tbody></table>${!list.length ? '<div class="empty-table">Henüz sipariş yok. Mağazadan bir demo siparişi oluşturabilirsin.</div>' : ""}</div>`;
}
function couponForm(
  c = { code: "", percent: 10, minimum: 150000, usageLimit: 100, active: true },
) {
  return `<h3>${c.code ? "Kuponu düzenle" : "Yeni kupon"}</h3><form data-form="coupon-admin"><div class="form-grid">${field("Kupon kodu", "code", c.code, "text", 'required pattern="[A-Za-z0-9_-]{3,30}" maxlength="30"')}${field("İndirim (%)", "percent", c.percent, "number", 'min="1" max="70" required')}${field("Minimum sepet (₺)", "minimum", c.minimum / 100, "number", 'min="0" step="0.01" required')}${field("Kullanım limiti", "usageLimit", c.usageLimit, "number", 'min="1" max="100000" required')}</div><label class="checkbox-line"><input name="active" type="checkbox" ${c.active ? "checked" : ""}> Aktif</label><div data-error></div><button class="button button-dark">Kuponu kaydet</button></form>`;
}
async function adminPage() {
  if (S.user?.role !== "admin") return authPage(true);
  adminData = await S.adminData();
  const a = adminData;
  let content = "";
  if (adminTab === "overview") content = overviewContent(a);
  if (adminTab === "products")
    content = `<div class="admin-title"><div><div class="eyebrow">KOLEKSİYONUN</div><h2>Ürünler</h2></div><button class="button button-dark" data-edit-product="new">+ Yeni ürün</button></div><label class="admin-search">Ürün ara<input id="adminProductSearch" type="search" placeholder="Ürün adı, kategori…"></label><div class="table-scroll"><table><thead><tr><th>Ürün</th><th>Kategori</th><th>Fiyat</th><th>Stok</th><th>Durum</th><th></th></tr></thead><tbody>${a.products.map((p) => `<tr data-product-row data-search="${esc((p.name + " " + p.kind + " " + p.category).toLocaleLowerCase("tr"))}"><td><div class="table-product"><img src="${esc(p.image)}" alt=""><span>${esc(p.kind)}<small>${esc(p.name)}</small></span></div></td><td>${esc(cats()[p.category])}</td><td>${money(p.price)}</td><td>${p.stock}</td><td><span class="status-pill">${p.published ? "Yayında" : "Taslak"}</span></td><td><button class="subtle-link" data-edit-product="${esc(p.id)}">Düzenle</button></td></tr>`).join("")}</tbody></table></div>`;
  if (adminTab === "categories" || adminTab === "collections")
    content = taxonomyPage(adminTab, a);
  if (adminTab === "orders")
    content = `<div class="admin-title"><h2>Hikâyelerin yolculuğu</h2></div>${orderTable(filteredAdminOrders(a.orders), true)}`;
  if (adminTab === "customers")
    content = `<div class="admin-title"><h2>Müşteriler</h2></div><div class="table-scroll"><table><thead><tr><th>Ad</th><th>E-posta</th><th>Kayıt tarihi</th></tr></thead><tbody>${a.customers.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.email)}</td><td>${date(c.createdAt)}</td></tr>`).join("")}</tbody></table>${!a.customers.length ? '<p class="empty-table">Henüz kayıtlı müşteri yok.</p>' : ""}</div><p class="field-hint">Misafir bilgileri ilgili siparişin ayrıntılarında görünür.</p>`;
  if (adminTab === "coupons")
    content = `<div class="admin-title"><h2>Kuponlar</h2></div><div class="table-scroll"><table><thead><tr><th>Kod</th><th>İndirim</th><th>Alt limit</th><th>Kullanım</th><th>Durum</th><th></th></tr></thead><tbody>${a.coupons.map((c) => `<tr><td><strong>${esc(c.code)}</strong></td><td>%${c.percent}</td><td>${money(c.minimum)}</td><td>${c.used} / ${c.usageLimit}</td><td>${c.active ? "Aktif" : "Kapalı"}</td><td><button class="subtle-link" data-edit-coupon="${esc(c.code)}">Düzenle</button></td></tr>`).join("")}</tbody></table></div><div class="surface coupon-editor" id="couponEditor">${couponForm()}</div>`;
  if (adminTab === "banners") {
    bannerImage = a.settings.banner.image;
    content = bannerEditor(a.settings.banner);
  }
  if (adminTab === "legal")
    content = legalEditor(a.settings.legalPages, selectedLegalPage);
  if (adminTab === "settings") {
    const s = a.settings;
    content = `<div class="admin-title"><h2>Kargo & duyuru</h2></div><form class="surface-form" data-form="settings">${field("Duyuru metni", "announcement", s.announcement, "text", 'required maxlength="200"')}<div class="form-grid">${field("Kargo ücreti (₺)", "shippingFee", s.shippingFee / 100, "number", 'min="0" max="1000000" step="0.01" required')}${field("Ücretsiz kargo eşiği (₺)", "freeShippingThreshold", s.freeShippingThreshold / 100, "number", 'min="0" max="1000000" step="0.01" required')}${field("Hazırlık süresi", "preparationDays", s.preparationDays, "text", 'required maxlength="80"')}${field("Destek e-postası", "supportEmail", s.supportEmail, "email", 'maxlength="160"')}</div><label>Marka hikâyesi<textarea name="about" required maxlength="2000">${esc(s.about)}</textarea></label><div data-error></div><button class="button button-dark">Ayarları kaydet ${icon("check")}</button></form>`;
  }
  main.innerHTML = `<div class="admin-shell"><aside class="admin-sidebar"><a class="admin-wordmark" href="#/admin">NEEDLEMARKS<small>Yönetim</small></a><nav aria-label="Yönetim menüsü">${Object.entries(
    adminTabs,
  )
    .map(
      ([k, n]) =>
        `<button data-admin-tab="${k}" class="${k === adminTab ? "selected" : ""}">${adminMenuIcon(k)}<span>${n}</span></button>`,
    )
    .join(
      "",
    )}</nav><div class="admin-bottom"><a href="#/">← Mağazaya dön</a><button data-action="logout">Çıkış yap</button>${S.mode === "demo" ? '<button data-action="reset-demo">Demo verilerini sıfırla</button>' : ""}</div></aside><section class="admin-main">${notice()}${content}</section></div>`;
  const noteSlot = $("[data-category-note]");
  if (noteSlot) {
    const note = $(".admin-main>.mode-note");
    if (note) noteSlot.append(note);
  }
}
function editProduct(id) {
  const p = adminData.products.find((product) => product.id === id) || {
    id: "",
    name: "",
    category: "",
    price: 0,
    stock: 0,
    colors: ["Doğal"],
    sizes: ["Standart"],
    collections: [],
    description: "",
    material: "",
    care: "",
    published: false,
  };
  editorImages = [...(p.images || (p.image ? [p.image] : []))];
  $(".admin-main").innerHTML =
    notice() +
    productEditor(
      p,
      adminData.categories,
      adminData.collections,
      S.mode === "demo",
    );
  renderEditorGallery();
  renderOptions();
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}
function modal(content) {
  $("#productContent").innerHTML = content;
  $("#productDialog").showModal();
  document.body.style.overflow = "hidden";
}
function closeModal() {
  if ($("#productDialog").open) $("#productDialog").close();
  document.body.style.overflow = "";
}
function notFound(message = "Aradığın sayfa burada değil.") {
  main.innerHTML =
    heading("Yeni bir <em>yol bulalım.</em>", "SAYFA BULUNAMADI") +
    `<div class="empty-state"><p>${esc(message)}</p><a class="button button-dark" href="#/urunler">Koleksiyona dön</a></div>`;
}
async function render() {
  const hash = location.hash.slice(1),
    parts = (hash.startsWith("/") ? hash : "/").split("/").filter(Boolean),
    page = parts[0] || "home";
  document.body.classList.toggle("admin-view", page === "admin");
  main.setAttribute("aria-busy", "true");
  try {
    header();
    document.title = `${{ home: "Anıların, ilmek ilmek.", urunler: "Koleksiyon", urun: "Sana özel", sepet: "Sepetin", odeme: "Teslimat", hesabim: "Hesabım", admin: "Atölye yönetimi", favoriler: "Favorilerin" }[page] || "Hikâyenin devamı"} · NEEDLEMARKS`;
    if (page === "home") {
      main.innerHTML = home;
      applyHomeBanner();
      $(".category-tabs").innerHTML = Object.entries(cats())
        .map(
          ([id, name]) =>
            `<button data-category="${esc(id)}" class="${id === "all" ? "selected" : ""}">${esc(name)}</button>`,
        )
        .join("");
      filters = {
        category: "all",
        search: "",
        sort: "featured",
        max: "",
        size: "",
      };
      grid();
    } else if (page === "urunler" || page === "favoriler")
      catalogPage(page === "favoriler");
    else if (page === "urun") detailPage(decodeURIComponent(parts[1] || ""));
    else if (page === "sepet") await cartPage();
    else if (page === "odeme") await checkoutPage();
    else if (page === "hesabim") await accountPage();
    else if (page === "siparis")
      await orderPage(decodeURIComponent(parts[1] || ""));
    else if (page === "admin") await adminPage();
    else if (page === "kategori") {
      const key = decodeURIComponent(parts[1] || ""),
        category = S.catalog.categories.find(
          (record) =>
            record.active !== false &&
            (record.id === key ||
              (record.slug || categorySlug(record.name)) === key),
        );
      if (!category) notFound();
      else {
        filters = {
          category: category.id,
          search: "",
          sort: "featured",
          max: "",
          size: "",
          collection: "",
        };
        catalogPage();
      }
    } else if (page === "bilgi") {
      const info = S.catalog.settings.legalPages.find(
        (item) => item.id === parts[1],
      );
      if (info)
        main.innerHTML =
          heading(esc(info.title), "BİLMEN GEREKENLER") + legalBody(info);
      else notFound();
    } else contentPage(page);
    if (hash.startsWith("/"))
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    $("#mainNav").classList.remove("open");
    $("#menuToggle").setAttribute("aria-expanded", "false");
  } catch (err) {
    main.innerHTML =
      heading("Küçük bir <em>aksilik.</em>") +
      `<section class="empty-state">${errorHTML(err)}<button class="button button-dark" data-action="retry">Tekrar dene</button></section>`;
  } finally {
    main.removeAttribute("aria-busy");
  }
}

document.addEventListener("click", async (event) => {
  if (optionAction(event.target, modal, closeModal)) return;
  const t = event.target.closest("button,a");
  if (!t) return;
  try {
    if (t.closest(".cart-toggle")) go("sepet");
    if (t.id === "searchToggle") go("urunler");
    if (t.id === "favoritesToggle") {
      filters = {
        category: "all",
        search: "",
        sort: "featured",
        max: "",
        size: "",
      };
      go("favoriler");
    }
    if (t.id === "menuToggle") {
      const open = $("#mainNav").classList.toggle("open");
      t.setAttribute("aria-expanded", String(open));
    }
    if (t.dataset.gallery !== undefined) showGallery(Number(t.dataset.gallery));
    if (t.dataset.galleryStep)
      showGallery(detailGallery.index + Number(t.dataset.galleryStep));
    if (t.dataset.cover !== undefined) {
      editorImages = moveToCover(editorImages, Number(t.dataset.cover));
      renderEditorGallery();
    }
    if (t.dataset.removeImage !== undefined) {
      editorImages.splice(Number(t.dataset.removeImage), 1);
      renderEditorGallery();
    }
    if (t.dataset.favorite) {
      S.toggleFavorite(t.dataset.favorite);
      t.classList.toggle("saved", S.favorites.includes(t.dataset.favorite));
      t.setAttribute(
        "aria-pressed",
        String(S.favorites.includes(t.dataset.favorite)),
      );
      if (location.hash === "#/favoriler") grid(true);
      toast(
        S.favorites.includes(t.dataset.favorite)
          ? "Kalbine yakın olanlara eklendi."
          : "Favorilerinden kaldırıldı.",
      );
    }
    if (t.dataset.category) {
      filters.category = t.dataset.category;
      $$("[data-category]").forEach((b) => {
        b.classList.toggle("selected", b === t);
        b.setAttribute("aria-pressed", String(b === t));
      });
      grid();
    }
    if (t.dataset.quantity) {
      const item = S.cart.find((i) => i.key === t.dataset.quantity),
        p = S.catalog.products.find((p) => p.id === item.id);
      item.quantity += Number(t.dataset.change);
      const total = S.cart
        .filter((i) => i.id === p.id)
        .reduce((s, i) => s + i.quantity, 0);
      const variant = selectedVariant(p, item.selections);
      const variantTotal = S.cart
        .filter(
          (i) =>
            i.id === p.id &&
            selectedVariant(p, i.selections).stockKey === variant.stockKey,
        )
        .reduce((sum, i) => sum + i.quantity, 0);
      if (
        item.quantity > 20 ||
        total > p.stock ||
        variantTotal > variant.stock
      ) {
        item.quantity--;
        throw new Error("Stok veya adet sınırına ulaştın.");
      }
      if (item.quantity <= 0) S.removeCart(item.key);
      else S.saveCart();
      await render();
    }
    if (t.dataset.remove) {
      S.removeCart(t.dataset.remove);
      await render();
    }
    if (t.dataset.adminTab) {
      adminTab = t.dataset.adminTab;
      orderFilter = "";
      await adminPage();
    }
    if (t.dataset.editProduct) editProduct(t.dataset.editProduct);
    if (t.dataset.orderFilter) {
      orderFilter = t.dataset.orderFilter;
      adminTab = "orders";
      await adminPage();
    }
    if (t.dataset.legalPage) {
      selectedLegalPage = t.dataset.legalPage;
      await adminPage();
    }

    if (t.dataset.editTaxonomy) {
      const type = t.dataset.taxonomyType;
      const record = adminData[type].find(
        (item) => item.id === t.dataset.editTaxonomy,
      );
      if (type === "categories")
        categoryImage = categoryCover(record, adminData.products);
      modal(
        taxonomyEditor(
          type,
          adminData[type].find((item) => item.id === t.dataset.editTaxonomy),
          adminData.products,
        ),
      );
    }
    if (t.dataset.removeTaxonomy) {
      await S.removeTaxonomy(t.dataset.taxonomyType, t.dataset.removeTaxonomy);
      await adminPage();
      toast("Kayıt silindi.");
    }

    if (t.dataset.editCoupon) {
      $("#couponEditor").innerHTML = couponForm(
        adminData.coupons.find((c) => c.code === t.dataset.editCoupon),
      );
      $("#couponEditor").scrollIntoView({ behavior: "smooth" });
    }
    if (
      t.classList.contains("dialog-close") ||
      t.hasAttribute("data-close-modal")
    )
      closeModal();
    const action = t.dataset.action;
    if (action === "sample-photo") {
      if (editorImages.length >= 8)
        throw new Error("En fazla 8 fotoğraf eklenebilir.");
      editorImages.push("assets/hero.webp");
      renderEditorGallery();
    }

    if (action === "reset-filters") {
      filters = {
        category: "all",
        search: "",
        sort: "featured",
        max: "",
        size: "",
      };
      if (location.hash.startsWith("#/")) await render();
      else grid();
    }
    if (action === "demo-login") {
      await S.login();
      go("hesabim");
    }
    if (action === "demo-admin") {
      S.demoAdmin();
      await adminPage();
    }
    if (action === "logout") {
      await S.logout();
      go("hesabim");
      await render();
    }
    if (action === "show-register") authPage(false, true);
    if (action === "show-login") authPage();
    if (action === "retry") await render();
    if (action === "close-modal") closeModal();
    if (action === "reset-demo")
      modal(
        '<div class="editor-form"><h2>Örnek verileri sıfırla?</h2><p>Bu tarayıcıdaki demo siparişler, ürün değişiklikleri, sepet ve favoriler başlangıç durumuna döner. Yerel sunucu veritabanı etkilenmez.</p><button class="button button-dark" data-action="confirm-reset">Demo verilerini sıfırla</button></div>',
      );
    if (action === "confirm-reset") await S.resetDemo();
    if (action === "size-guide")
      modal(
        '<div class="editor-form"><div class="eyebrow">ÖRNEK BEDEN REHBERİ</div><h2>Kendine uygun olanı bul.</h2><p>Bu ölçüler yalnızca tasarım örneğidir. Gerçek ürün ölçüleri marka tarafından doğrulanmalıdır.</p><table><thead><tr><th>Beden</th><th>Göğüs eni</th><th>Boy</th></tr></thead><tbody><tr><td>S</td><td>52 cm</td><td>66 cm</td></tr><tr><td>M</td><td>55 cm</td><td>69 cm</td></tr><tr><td>L</td><td>58 cm</td><td>72 cm</td></tr><tr><td>XL</td><td>61 cm</td><td>75 cm</td></tr></tbody></table></div>',
      );
  } catch (err) {
    toast(err.message);
  }
});
document.addEventListener("input", (event) => {
  if (variationInput(event.target)) return;
  if (
    event.target.id === "categoryName" &&
    $("#categorySlug")?.dataset.auto === "true"
  )
    $("#categorySlug").value = categorySlug(event.target.value);
  if (event.target.id === "categorySlug") event.target.dataset.auto = "false";
  if (event.target.id === "adminProductSearch") {
    const search = event.target.value.toLocaleLowerCase("tr");
    $$("[data-product-row]").forEach(
      (row) => (row.hidden = !row.dataset.search.includes(search)),
    );
  }
});
document.addEventListener("change", async (event) => {
  try {
    if (optionChange(event.target, modal)) return;
    if (event.target.matches("[data-customer-variation]")) {
      const form = event.target.closest("form"),
        p = S.catalog.products.find((p) => p.id === form.dataset.id);
      updateDetailChoices(p);
      setDetailGallery(
        p,
        detailSelections(p, form),
        event.target.name.slice("variation-".length),
      );
    }
    if (event.target.matches("[data-custom-photo]")) {
      const form = event.target.closest("form"),
        p = S.catalog.products.find((p) => p.id === form.dataset.id),
        field = fieldsFor(p).find(
          (f) => "custom-" + f.id === event.target.name,
        );
      const files = [...event.target.files],
        status = event.target.parentElement.querySelector(
          ".custom-photo-status",
        );
      if (
        files.length > field.maxFiles ||
        files.some(
          (file) =>
            file.size > 5 * 1024 * 1024 ||
            !["image/png", "image/jpeg", "image/webp"].includes(file.type),
        )
      ) {
        event.target.value = "";
        status.textContent = `En fazla ${field.maxFiles} fotoğraf; JPG, PNG veya WebP ve dosya başına 5 MB.`;
      } else status.textContent = files.map((file) => file.name).join(" · ");
    }
    if (event.target.id === "coverPhoto") {
      await addProductFiles([...event.target.files], true);
      event.target.value = "";
    }
    if (event.target.id === "productPhotos") {
      await addProductFiles([...event.target.files]);
      event.target.value = "";
    }
    if (event.target.id === "sort") {
      filters.sort = event.target.value;
      grid();
    }
    if (event.target.id === "categoryPhoto") {
      const file = event.target.files[0];
      if (!file) return;
      if (
        file.size > 5 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type)
      )
        throw new Error(
          "JPG, PNG veya WebP fotoğraf seç. Her görsel en fazla 5 MB olabilir.",
        );
      const button = $('[data-form="taxonomy"] button[type="submit"]');
      button.disabled = true;
      $("#categoryPhotoStatus").textContent = "Fotoğraf yükleniyor…";
      try {
        categoryImage = await S.uploadProductPhoto(file);
        $("#categoryImagePreview").innerHTML =
          `<img src="${esc(categoryImage)}" alt="Kategori kapak fotoğrafı">`;
        $("#categoryPhotoStatus").textContent = "Fotoğraf hazır.";
      } finally {
        button.disabled = false;
      }
    }
    if (event.target.id === "bannerPhoto") {
      const file = event.target.files[0];
      if (!file) return;
      if (
        file.size > 5 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type)
      )
        throw new Error(
          "JPG, PNG veya WebP görsel seç. Her görsel en fazla 5 MB olabilir.",
        );
      const submit = $('[data-form="banner"] button[type="submit"]');
      submit.disabled = true;
      $("#bannerPhotoStatus").textContent = "Görsel yükleniyor…";
      try {
        bannerImage = await S.uploadProductPhoto(file);
        $("#bannerImagePreview").src = bannerImage;
        $("#bannerPhotoStatus").textContent = "Görsel hazır.";
      } finally {
        submit.disabled = false;
      }
    }
    if (event.target.id === "detailPhoto") {
      const file = event.target.files[0];
      if (preview) {
        URL.revokeObjectURL(preview);
        preview = null;
      }
      $("#photoPreview").hidden = true;
      if (!file) return;
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 5 * 1024 * 1024
      ) {
        event.target.value = "";
        throw new Error("PNG, JPG veya WebP seç; en fazla 5 MB.");
      }
      preview = URL.createObjectURL(file);
      $("#photoPreview").src = preview;
      $("#photoPreview").hidden = false;
      $("#photoStatus").textContent =
        S.mode === "demo"
          ? "Fotoğraf sadece bu açık tarayıcı oturumunda önizlenir."
          : "Fotoğraf, sepete eklerken yerel sunucuya kaydedilir.";
    }
    if (event.target.dataset.orderStatus) {
      const id = event.target.dataset.orderStatus,
        old = adminData.orders.find((o) => o.id === id)?.status;
      try {
        await S.updateOrder(id, event.target.value);
        await adminPage();
        toast("Sipariş durumu güncellendi.");
      } catch (err) {
        event.target.value = old;
        throw err;
      }
    }
  } catch (err) {
    toast(err.message);
  }
});
document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!form.dataset.form) return;
  event.preventDefault();
  const submit = $('button[type="submit"],button:not([type])', form),
    data = Object.fromEntries(new FormData(form)),
    error = $("[data-error]", form);
  if (error) error.innerHTML = "";
  if (submit) submit.disabled = true;
  try {
    switch (form.dataset.form) {
      case "filters":
        filters = { ...filters, ...data };
        grid(location.hash === "#/favoriler");
        break;
      case "variation-manager": {
        saveManager();
        closeModal();
        renderOptions();
        toast("Varyasyonlar uygulandı. Ürünü kaydetmeyi unutma.");
        break;
      }
      case "option-editor": {
        saveOption(form);
        if (form.dataset.kind === "variation") {
          showVariationManager(modal);
          break;
        }
        closeModal();
        renderOptions();
        toast("Alan uygulandı. Ürünü kaydetmeyi unutma.");
        break;
      }
      case "add-product": {
        const p = S.catalog.products.find((p) => p.id === form.dataset.id),
          quantity = Number(data.quantity),
          file = $("#detailPhoto")?.files[0];
        if (
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > Math.min(20, p.stock)
        )
          throw new Error("Adedi kontrol et.");
        const count = S.cart
          .filter((i) => i.id === p.id)
          .reduce((s, i) => s + i.quantity, 0);
        if (count + quantity > p.stock)
          throw new Error("Sepetindeki toplam adet stok miktarını aşıyor.");
        const selections = Object.fromEntries(
          (p.variations || []).map((group) => [
            group.id,
            data["variation-" + group.id],
          ]),
        );
        const answers = {};
        for (const field of fieldsFor(p)) {
          if (field.type === "file") {
            answers[field.id] = [];
            const files = [...form.elements["custom-" + field.id].files];
            if (files.length > field.maxFiles)
              throw new Error(
                `${field.name}: en fazla ${field.maxFiles} fotoğraf seç.`,
              );
            for (const file of files) {
              if (
                file.size > 5 * 1024 * 1024 ||
                !["image/png", "image/jpeg", "image/webp"].includes(file.type)
              )
                throw new Error(
                  "JPG, PNG veya WebP fotoğraf seç; her dosya en fazla 5 MB olabilir.",
                );
              answers[field.id].push({
                id: await S.uploadPhoto(file),
                name: file.name,
              });
            }
          } else answers[field.id] = data["custom-" + field.id] || "";
        }
        const resolved = resolveOptions(p, { selections, answers });
        const variantCount = S.cart
          .filter(
            (i) =>
              i.id === p.id &&
              selectedVariant(p, i.selections).stockKey === resolved.stockKey,
          )
          .reduce((sum, i) => sum + i.quantity, 0);
        if (variantCount + quantity > resolved.stock)
          throw new Error("Bu birleşim için yeterli stok yok.");
        S.cart.push({
          key: S.uid(),
          id: p.id,
          color: data.color || p.colors[0],
          size: data.size || p.sizes[0],
          managedVariations: p.managedVariations,
          sku: resolved.sku,
          image: variantPhotos(p, selections)[0] || p.image,
          processingProfile: resolved.processingProfile,
          quantity,
          selections,
          answers,
          optionSelections: resolved.selections,
          optionAnswers: resolved.answers,
        });
        S.saveCart();
        header();
        modal(
          `<div class="added-panel"><span class="checkout-icon">${icon("check")}</span><div class="eyebrow">HİKÂYENE EKLENDİ</div><h2>Güzel bir <em>başlangıç.</em></h2><p>${esc(p.kind)} · ${resolved.selections.length ? resolved.selections.map((row) => esc(row.value)).join(" · ") : esc(data.color || p.colors[0]) + " · " + esc(data.size || p.sizes[0])}</p><a class="button button-dark" href="#/sepet" data-close-modal>Sepetime git ${icon("bag")}</a><button class="text-link" type="button" data-action="close-modal">Keşfetmeye devam et</button></div>`,
        );
        break;
      }
      case "coupon":
        coupon = data.coupon.trim().toUpperCase();
        try {
          await S.quote(coupon);
        } catch (err) {
          coupon = "";
          throw err;
        }
        await cartPage();
        toast(coupon ? "Kupon uygulandı." : "Kupon kaldırıldı.");
        break;
      case "checkout": {
        const order = await S.placeOrder({
          customer: data,
          coupon,
          consent: data.consent === "on",
          idempotencyKey: orderKey,
        });
        orderKey = S.uid();
        coupon = "";
        go("siparis/" + encodeURIComponent(order.id));
        break;
      }
      case "login":
      case "register":
        await S.login(data, form.dataset.form === "register");
        if (form.dataset.admin === "true") {
          if (S.user.role !== "admin")
            throw new Error("Bu hesap yönetici yetkisine sahip değil.");
          await adminPage();
        } else {
          go("hesabim");
          await render();
        }
        break;
      case "tracking": {
        const orders = await S.getOrders(),
          order = orders.find(
            (o) => o.number.toUpperCase() === data.number.trim().toUpperCase(),
          );
        if (!order)
          throw new Error(
            "Sipariş bu oturumda bulunamadı. Doğru hesaba giriş yaptığından emin ol.",
          );
        go("siparis/" + order.id);
        break;
      }
      case "contact":
        form.reset();
        if (error)
          error.innerHTML =
            '<div class="inline-success">Demo formu tamamlandı. Gerçek mesaj veya e-posta gönderilmedi.</div>';
        break;
      case "product-admin": {
        if (uploading) throw new Error("Fotoğrafların yüklenmesini bekle.");
        if (!editorImages.length)
          throw new Error("En az bir ürün fotoğrafı ekle.");
        const old = adminData.products.find(
          (product) => product.id === form.dataset.id,
        );
        await S.saveProduct({
          ...old,
          ...data,
          ...readOptions(),
          id: form.dataset.id || S.uid(),
          kind: old?.kind || data.name,
          type: old?.type || "Ürün",
          badge: old?.badge || "SANA ÖZEL",
          price: Math.round(Number(data.price) * 100),
          stock: Number(data.stock),
          colors: (data.colors || old?.colors?.join(", ") || "Doğal")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
            .slice(0, 12),
          sizes: (data.sizes || old?.sizes?.join(", ") || "Standart")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
            .slice(0, 12),
          collections: new FormData(form).getAll("collections"),
          published: event.submitter?.value === "publish",
          featured: old?.featured || false,
          image: editorImages[0],
          images: [...editorImages],
          swatches: old?.swatches || ["#d8cfb9"],
        });
        if (location.hash.startsWith("#/admin")) await adminPage();
        toast("Ürün kaydedildi.");
        break;
      }
      case "taxonomy": {
        await S.saveTaxonomy(form.dataset.type, {
          id: form.dataset.id || undefined,
          name: data.name,
          ...(form.dataset.type === "categories"
            ? {
                slug: data.slug,
                image: categoryImage,
                active: data.active === "on",
              }
            : {}),
        });
        closeModal();
        await adminPage();
        toast("Kaydedildi.");
        break;
      }
      case "banner":
        await S.saveSettings({
          ...adminData.settings,
          banner: {
            ...data,
            image: bannerImage,
            visible: data.visible === "on",
          },
        });
        header();
        await adminPage();
        toast("Banner kaydedildi.");
        break;
      case "legal":
        await S.saveSettings({
          ...adminData.settings,
          legalPages: adminData.settings.legalPages.map((page) =>
            page.id === form.dataset.id
              ? { ...page, title: data.title, body: data.body }
              : page,
          ),
        });
        header();
        await adminPage();
        toast("Metin kaydedildi.");
        break;
      case "settings":
        await S.saveSettings({
          ...adminData.settings,
          ...data,
          shippingFee: Math.round(Number(data.shippingFee) * 100),
          freeShippingThreshold: Math.round(
            Number(data.freeShippingThreshold) * 100,
          ),
        });
        header();
        await adminPage();
        toast("Mağaza ayarları kaydedildi.");
        break;
      case "coupon-admin":
        await S.saveCoupon({
          ...data,
          code: data.code.toUpperCase(),
          percent: Number(data.percent),
          minimum: Math.round(Number(data.minimum) * 100),
          usageLimit: Number(data.usageLimit),
          active: data.active === "on",
        });
        await adminPage();
        toast("Kupon kaydedildi.");
        break;
    }
  } catch (err) {
    if (error) error.innerHTML = errorHTML(err);
    else toast(err.message);
  } finally {
    if (submit) submit.disabled = false;
  }
});
$("#productDialog").addEventListener(
  "close",
  () => (document.body.style.overflow = ""),
);
$("#productDialog").addEventListener("click", (event) => {
  if (event.target !== $("#productDialog")) return;
  const r = event.target.getBoundingClientRect();
  if (
    event.clientX < r.left ||
    event.clientX > r.right ||
    event.clientY < r.top ||
    event.clientY > r.bottom
  )
    closeModal();
});
window.addEventListener("hashchange", () => {
  closeModal();
  if (preview) {
    URL.revokeObjectURL(preview);
    preview = null;
  }
  render();
});
let uploading = false,
  bannerImage,
  categoryImage,
  selectedLegalPage = "kvkk",
  orderFilter = "";
await S.refresh();
await render();

function renderEditorGallery() {
  if (!$("#editorGallery")) return;
  syncVariationImages(editorImages);
  const cover = $("#coverPreview");
  if (cover)
    cover.innerHTML = editorImages[0]
      ? `<img src="${esc(editorImages[0])}" alt="Vitrin görseli"><span>Vitrin görselini değiştir</span>`
      : "<span>Vitrin görselini buraya bırak</span>";

  if ($("#photoCount"))
    $("#photoCount").textContent = editorImages.length + " / 8";
  $("#editorGallery").innerHTML = editorImages
    .map(
      (image, i) =>
        `<div draggable="true" data-gallery-drag="${i}" title="Vitrin alanına sürükleyerek kapak yap"><button type="button" data-cover="${i}" aria-label="${i + 1}. görseli kapak seç"><img src="${esc(image)}" alt="Ürün fotoğrafı ${i + 1}"></button><span>${i === 0 ? "Kapak" : i + 1 + ". görsel"}</span><button type="button" class="remove-item" data-remove-image="${i}">Kaldır</button></div>`,
    )
    .join("");
}

async function addProductFiles(files, asCover = false) {
  if (uploading) return;
  if (editorImages.length + files.length > 8)
    throw new Error("En fazla 8 fotoğraf eklenebilir.");
  if (asCover && files.length !== 1)
    throw new Error(
      "Vitrin için tek fotoğraf bırak. Diğer fotoğrafları galeri alanına ekleyebilirsin.",
    );
  files.forEach(validatePhoto);
  if (!files.length) return;
  uploading = true;
  const form = $('[data-form="product-admin"]');
  const buttons = $$('button[type="submit"]', form);
  buttons.forEach((button) => (button.disabled = true));
  const status = $("#photoUploadStatus");
  status.textContent = "Fotoğraflar yükleniyor…";
  try {
    const images = await Promise.all(
      files.map((file) => S.uploadProductPhoto(file)),
    );
    if (asCover) editorImages.unshift(...images);
    else editorImages.push(...images);
    renderEditorGallery();
    status.textContent = "Fotoğraflar eklendi.";
  } finally {
    uploading = false;
    buttons.forEach((button) => (button.disabled = false));
    if (status.textContent === "Fotoğraflar yükleniyor…")
      status.textContent = "";
  }
}
document.addEventListener("dragstart", (event) => {
  const item = event.target.closest("[data-gallery-drag]");
  if (!item) return;
  event.dataTransfer.setData(
    "application/x-needlemarks-photo",
    item.dataset.galleryDrag,
  );
  event.dataTransfer.effectAllowed = "move";
});
for (const name of ["dragover", "dragleave", "drop"])
  document.addEventListener(name, async (event) => {
    const zone = event.target.closest("[data-product-dropzone]");
    if (!zone) return;
    event.preventDefault();
    zone.classList.toggle("dragging", name === "dragover");
    if (name === "dragover")
      event.dataTransfer.dropEffect = [...event.dataTransfer.types].includes(
        "application/x-needlemarks-photo",
      )
        ? "move"
        : "copy";
    if (name !== "drop") return;
    try {
      const index = event.dataTransfer.getData(
        "application/x-needlemarks-photo",
      );
      if (index !== "" && zone.hasAttribute("data-upload-cover")) {
        editorImages = moveToCover(editorImages, Number(index));
        renderEditorGallery();
        $("#photoUploadStatus").textContent =
          "Vitrin görseli değiştirildi. Ürünü kaydetmeyi unutma.";
      } else
        await addProductFiles(
          [...event.dataTransfer.files],
          zone.hasAttribute("data-upload-cover"),
        );
    } catch (error) {
      $("#photoUploadStatus").textContent = error.message;
    }
  });

function applyHomeBanner() {
  const banner = S.catalog.settings.banner;
  const hero = $(".hero");
  hero.hidden = banner.visible === false;
  $("#heroTitle").innerHTML = banner.title
    .split("\n")
    .map((line, index) => (index === 1 ? `<em>${esc(line)}</em>` : esc(line)))
    .join("<br>");
  $(".hero-copy>p").innerHTML = esc(banner.description).replace(/\n/g, "<br>");
  const button = $(".hero-copy>.button");
  button.innerHTML = esc(banner.buttonText) + " " + icon("arrow");
  button.href = banner.buttonLink;
  $(".hero-image").src = banner.image;
}
function filteredAdminOrders(orders) {
  return orders.filter(
    (order) =>
      !orderFilter ||
      (orderFilter === "new"
        ? order.status === "demo-received"
        : orderFilter === "preparing"
          ? ["designing", "production"].includes(order.status)
          : order.status === "shipped"),
  );
}
function overviewContent(a) {
  const groups = [
    [
      "new",
      "Yeni sipariş",
      a.orders.filter((o) => o.status === "demo-received").length,
      "İncelenmeyi bekliyor",
    ],
    [
      "preparing",
      "Hazırlanıyor",
      a.orders.filter((o) => ["designing", "production"].includes(o.status))
        .length,
      "Tasarım ve üretim aşamasında",
    ],
    [
      "shipped",
      "Kargoda",
      a.orders.filter((o) => o.status === "shipped").length,
      "Teslim edilmesi bekleniyor",
    ],
  ];
  const low = a.products.filter(
    (product) => product.published && product.stock <= 5,
  );
  return `<div class="admin-title"><div><div class="eyebrow">KONTROL SENDE.</div><h2>Genel bakış</h2></div></div><div class="stats-grid">${[
    [
      "Demo sipariş tutarı",
      money(a.orders.reduce((sum, order) => sum + order.total, 0)),
    ],
    ["Gerçek tahsilat", money(0)],
    ["Sipariş sayısı", a.orders.length],
    ["Aktif ürün", a.products.filter((product) => product.published).length],
  ]
    .map(
      ([title, value]) =>
        `<article><span>${title}</span><strong>${value}</strong></article>`,
    )
    .join(
      "",
    )}</div><section class="operations-card"><div class="section-kicker">SİPARİŞ AKIŞI</div><h3>Operasyon görünümü</h3><div class="operation-grid">${groups.map(([id, title, count, note]) => `<button data-order-filter="${id}"><span>${title}${adminMenuIcon(id === "shipped" ? "settings" : "products")}</span><strong>${count}</strong><small>${note}</small></button>`).join("")}</div></section><section class="operations-card"><div class="section-kicker">ENVANTER</div><div class="inventory-heading"><h3>Stok uyarıları</h3><button class="text-link" data-admin-tab="products">Ürünleri yönet ↗</button></div>${low.length ? low.map((product) => `<button class="stock-warning" data-edit-product="${esc(product.id)}"><span>${esc(product.name)}</span><strong>${product.stock} adet</strong></button>`).join("") : '<p class="field-hint">Düşük stoklu ürün yok. Stokların güncel.</p>'}</section><section class="operations-card"><div class="section-kicker">SON SİPARİŞLER</div>${orderTable(a.orders.slice(0, 6))}</section>`;
}
function adminMenuIcon(key) {
  const shapes = {
    overview:
      '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    products:
      '<path d="m12 3 9 5v9l-9 5-9-5V8l9-5Zm-9 5 9 5 9-5M12 13v9M7.5 5.5l9 5"/>',
    collections:
      '<path d="M3 3h8l10 10-8 8L3 11V3Z"/><circle cx="7.5" cy="7.5" r="1"/>',
    categories:
      '<path d="M3 3h8l10 10-8 8L3 11V3Z"/><circle cx="7.5" cy="7.5" r="1"/>',
    orders:
      '<path d="M4 7h16v14H4zM8 7V5a4 4 0 0 1 8 0v2M8 12a4 4 0 0 0 8 0"/>',
    customers:
      '<circle cx="9" cy="7" r="4"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M17 4a4 4 0 0 1 0 8m2 3a7 7 0 0 1 3 6"/>',
    coupons:
      '<path d="M3 3h8l10 10-8 8L3 11V3Z"/><circle cx="7.5" cy="7.5" r="1"/>',
    banners:
      '<rect x="3" y="3" width="18" height="18"/><circle cx="8" cy="8" r="2"/><path d="m3 18 6-6 4 4 4-6 4 6"/>',
    settings:
      '<path d="M2 5h12v13H2zM14 10h4l4 5v3h-8"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
    legal: '<path d="M5 2h10l4 4v16H5zM14 2v5h5M8 11h8M8 15h8M8 19h5"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${shapes[key] || shapes.overview}</svg>`;
}

let touchOrigin;
document.addEventListener(
  "touchstart",
  (event) => {
    if (event.target.closest(".detail-image"))
      touchOrigin = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
  },
  { passive: true },
);
document.addEventListener(
  "touchend",
  (event) => {
    if (!touchOrigin || !event.target.closest(".detail-image")) return;
    const dx = event.changedTouches[0].clientX - touchOrigin.x,
      dy = event.changedTouches[0].clientY - touchOrigin.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy))
      showGallery(detailGallery.index + (dx < 0 ? 1 : -1));
    touchOrigin = null;
  },
  { passive: true },
);
document.addEventListener("keydown", (event) => {
  if (event.target.id === "newVariationOption" && event.key === "Enter") {
    event.preventDefault();
    document.querySelector("[data-option-append]").click();
  }
  if (
    event.target.closest(".detail-image") &&
    ["ArrowLeft", "ArrowRight"].includes(event.key)
  ) {
    event.preventDefault();
    showGallery(detailGallery.index + (event.key === "ArrowRight" ? 1 : -1));
  }
});
for (const type of ["dragstart", "dragover", "drop"])
  document.addEventListener(type, (event) => variationDrag(event, modal));
function detailSelections(
  p,
  form = document.querySelector('[data-form="add-product"]'),
) {
  return Object.fromEntries(
    (p.variations || []).map((group) => [
      group.id,
      form?.elements["variation-" + group.id]?.value || "",
    ]),
  );
}
function updateDetailChoices(p) {
  const form = document.querySelector('[data-form="add-product"]');
  if (!form) return;
  const selected = detailSelections(p, form);
  for (const group of p.variations || []) {
    const controls = [
      ...form.querySelectorAll("[data-customer-variation]"),
    ].filter((input) => input.name === "variation-" + group.id);
    for (const control of controls) {
      const options =
        control.tagName === "SELECT"
          ? [...control.options].filter((option) => option.value)
          : [control];
      for (const option of options) {
        const value = option.dataset.optionValue ?? option.value;
        option.dataset.optionValue = value;
        const global = matchingVariants(p, { [group.id]: value }),
          states = matchingVariants(p, { ...selected, [group.id]: value }),
          sold =
            states.length > 0 && states.every((state) => state.stock === 0);
        option.disabled = !states.some((state) => state.stock > 0);
        if (control.tagName === "SELECT") {
          option.value = value;
          option.textContent =
            value +
            (sold ? " · Tükendi" : !states.length ? " · Kullanılamıyor" : "");
          option.hidden = !global.length;
        } else {
          const label = option.closest("label");
          label.hidden = !global.length;
          label.classList.toggle("unavailable", option.disabled);
          const hint = label.querySelector("[data-option-stock]");
          if (hint)
            hint.textContent = sold
              ? "Tükendi"
              : !states.length
                ? "Kullanılamıyor"
                : "";
        }
      }
    }
  }
  const complete = (p.variations || []).every((group) => selected[group.id]);
  const states = matchingVariants(p, selected),
    button = form.querySelector(".detail-purchase button");
  let current = null;
  try {
    if (complete) current = selectedVariant(p, selected);
  } catch {}
  button.disabled = !current || current.stock < 1;
  button.textContent =
    current && current.stock === 0 ? "Tükendi" : "Hikâyeme ekle";
  const status = document.querySelector("#variantAvailability");
  if (status)
    status.textContent = current
      ? current.stock
        ? `Seçtiğin birleşim: ${current.stock} adet stokta`
        : "Seçtiğin birleşim tükendi."
      : complete
        ? "Bu birleşim şu anda kullanılamıyor."
        : "Seçeneklerini tamamla.";
  if (
    current ||
    (states.length && states.every((state) => state.price === states[0].price))
  )
    document.querySelector(".detail-price").firstChild.textContent =
      money(current?.price ?? states[0].price) + " ";
  else
    document.querySelector(".detail-price").firstChild.textContent =
      money(p.price) + " ";
  if (current) form.elements.quantity.max = Math.min(20, current.stock) || 1;
  document.querySelector("#detailProcessing").textContent =
    "Örnek hazırlık: " +
    (current?.processingProfile || S.catalog.settings.preparationDays) +
    ". Demo siparişi üretime gönderilmez.";
}
function setDetailGallery(p, selected, preferred) {
  detailGallery = {
    id: p.id,
    images: variantPhotos(p, selected, preferred),
    index: 0,
  };
  document.querySelector("#detailThumbs").innerHTML = detailGallery.images
    .map(
      (src, index) =>
        `<button type="button" data-gallery="${index}" aria-label="Ürün görseli ${index + 1}"><img src="${esc(src)}" alt=""></button>`,
    )
    .join("");
  showGallery(0);
}
function showGallery(index) {
  const img = document.querySelector("#detailMainImage");
  if (!img || !detailGallery.images.length) return;
  const count = detailGallery.images.length;
  detailGallery.index = (index + count) % count;
  const src = detailGallery.images[detailGallery.index];
  if (img.getAttribute("src") !== src) {
    img.classList.add("gallery-loading");
    img.onload = () => img.classList.remove("gallery-loading");
    img.onerror = () => img.classList.remove("gallery-loading");
    img.src = src;
  }
  document
    .querySelectorAll("[data-gallery-step]")
    .forEach((button) => (button.hidden = count < 2));
  document.querySelector("#galleryCounter").textContent =
    `${detailGallery.index + 1} / ${count}`;
  document
    .querySelectorAll("#detailThumbs [data-gallery]")
    .forEach((button, index) =>
      button.setAttribute(
        "aria-current",
        String(index === detailGallery.index),
      ),
    );
}
