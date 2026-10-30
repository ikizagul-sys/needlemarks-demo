import {
  fieldsFor,
  combinations,
  variantKey,
  normalizeOptions,
} from "./product-options.js";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let draft;
const uid = () => crypto.randomUUID();
export function optionsEditor(product) {
  draft = structuredClone({
    variations: product.variations || [],
    variants: product.variants || [],
    customFields: fieldsFor(product),
  });
  return `<section class="editor-card item-options"><div class="editor-card-heading"><div><h2>Ürün seçenekleri</h2><p>Müşterin bu ürünü nasıl kişiselleştirsin?</p></div></div><div class="option-section"><div class="editor-card-heading"><div><h3>Varyasyonlar</h3><p>Örn. Nakış yeri: Sağ kol, Sol kol, İki kol.</p></div><button type="button" class="button button-outline" data-option-add="variation">＋ Varyasyon ekle</button></div><div id="variationRows"></div><label class="checkbox-line"><input type="checkbox" id="variantInventory" ${draft.variants.length ? "checked" : ""}> Her birleşim için farklı fiyat ve stok belirle</label><div id="variantRows"></div><small>Kapalıysa tüm seçenekler ürünün fiyatını ve ortak stokunu kullanır.</small></div><div class="option-section"><div class="editor-card-heading"><div><h3>Kişiselleştirme alanları</h3><p>İsim, fotoğraf veya nakış rengi gibi detayları al.</p></div><button type="button" class="button button-outline" data-option-add="field">＋ Alan ekle</button></div><div id="customFieldRows"></div><small>En fazla 5 alan. Bu alanlar stok miktarını değiştirmez.</small></div></section>`;
}
export function renderOptions() {
  const groups = document.querySelector("#variationRows");
  if (!groups) return;
  groups.innerHTML =
    draft.variations
      .map(
        (group, i) =>
          `<div class="option-row"><div><strong>${esc(group.name)}</strong><p>${group.options.map(esc).join(" · ")}</p></div><button type="button" data-option-edit="variation" data-index="${i}">Düzenle</button><button type="button" data-option-remove="variation" data-index="${i}" aria-label="${esc(group.name)} sil">Sil</button></div>`,
      )
      .join("") || '<p class="options-empty">Henüz varyasyon eklenmedi.</p>';
  document.querySelector("#customFieldRows").innerHTML =
    draft.customFields
      .map(
        (field, i) =>
          `<div class="option-row"><span class="option-type-icon">${{ text: "T", file: "▧", select: "☷" }[field.type]}</span><div><strong>${esc(field.name)}</strong><p>${field.required ? "Zorunlu" : "İsteğe bağlı"} · ${{ text: `Metin · ${field.maxLength} karakter`, file: `Fotoğraf · En fazla ${field.maxFiles} dosya`, select: `Seçim listesi · ${field.options?.length} seçenek` }[field.type]}</p></div><button type="button" data-option-edit="field" data-index="${i}">Düzenle</button><button type="button" data-option-remove="field" data-index="${i}" aria-label="${esc(field.name)} sil">Sil</button></div>`,
      )
      .join("") ||
    '<p class="options-empty">Müşteriden ek bilgi istemiyorsan boş bırakabilirsin.</p>';
  document.querySelector('[data-option-add="variation"]').disabled =
    draft.variations.length >= 2;
  document.querySelector('[data-option-add="field"]').disabled =
    draft.customFields.length >= 5;
  renderVariants();
}
function captureVariants() {
  const rows = [...document.querySelectorAll("[data-variant-key]")];
  if (rows.length)
    draft.variants = rows.map((row) => ({
      key: row.dataset.variantKey,
      price: Math.round(
        Number(row.querySelector("[data-variant-price]").value) * 100,
      ),
      stock: Number(row.querySelector("[data-variant-stock]").value),
    }));
}
function renderVariants() {
  const container = document.querySelector("#variantRows");
  if (
    !document.querySelector("#variantInventory").checked ||
    !draft.variations.length
  ) {
    container.innerHTML = "";
    return;
  }
  const form = container.closest("form");
  container.innerHTML = `<div class="table-scroll"><table class="variant-table"><thead><tr><th>Birleşim</th><th>Fiyat (₺)</th><th>Stok</th></tr></thead><tbody>${combinations(
    draft.variations,
  )
    .map((values) => {
      const key = variantKey(values),
        row = draft.variants.find((row) => row.key === key);
      return `<tr data-variant-key="${esc(key)}"><td>${values.map(esc).join(" / ")}</td><td><input aria-label="${esc(values.join(" / "))} fiyat" data-variant-price type="number" min="0.01" max="1000000" step="0.01" required value="${(row?.price ?? Math.round(Number(form.elements.price.value) * 100)) / 100}"></td><td><input aria-label="${esc(values.join(" / "))} stok" data-variant-stock type="number" min="0" max="100000" required value="${row?.stock ?? Number(form.elements.stock.value)}"></td></tr>`;
    })
    .join(
      "",
    )}</tbody></table></div><small>Üstteki ürün stoku toplam sınırdır. Birleşim stoku ayrıca kontrol edilir.</small>`;
}
export function readOptions() {
  captureVariants();
  return normalizeOptions({
    ...draft,
    variants:
      document.querySelector("#variantInventory").checked &&
      draft.variations.length
        ? draft.variants
        : [],
  });
}
export function optionAction(target, modal, closeModal) {
  const button = target.closest(
    "[data-option-add],[data-option-edit],[data-option-remove],[data-field-type]",
  );
  if (!button) return false;
  captureVariants();
  const kind =
    button.dataset.optionAdd ||
    button.dataset.optionEdit ||
    button.dataset.optionRemove;
  const list = kind === "variation" ? draft.variations : draft.customFields,
    index = Number(button.dataset.index);
  if (button.dataset.optionRemove) {
    list.splice(index, 1);
    renderOptions();
    return true;
  }
  if (button.dataset.optionAdd === "field") {
    modal(
      `<div class="option-modal"><div class="eyebrow">YENİ ALAN OLUŞTUR</div><h2>Hangi bilgiye ihtiyacın var?</h2><div class="field-type-list"><button data-field-type="text"><b>T</b><span>Metin kutusu<small>İsimler, tarihler veya kısa notlar</small></span>＋</button><button data-field-type="file"><b>▧</b><span>Fotoğraf yükleme<small>Evcil hayvan fotoğrafı, logo veya örnek</small></span>＋</button><button data-field-type="select"><b>☷</b><span>Seçenek listesi<small>İplik rengi, yazı tipi veya nakış konumu</small></span>＋</button></div><button class="text-link" data-action="close-modal">Vazgeç</button></div>`,
    );
    return true;
  }
  const variation = kind === "variation",
    record = button.dataset.optionEdit ? list[index] : null,
    type = button.dataset.fieldType || record?.type;
  const item = record || {
    id: uid(),
    name: variation ? "Nakış yeri" : "",
    type,
    required: true,
    options: variation ? ["Sağ kol", "Sol kol", "İki kol"] : [],
    instructions: "",
    maxLength: 180,
    maxFiles: 1,
  };
  modal(
    `<div class="option-modal"><div class="eyebrow">${variation ? "VARYASYON" : "KİŞİSELLEŞTİRME"}</div><h2>${record ? "Alanı düzenle" : variation ? "Varyasyon ekle" : "Alan ekle"}</h2><form data-form="option-editor" data-kind="${variation ? "variation" : "field"}" data-index="${record ? index : -1}" data-option-id="${esc(item.id)}" data-type="${esc(type || "")}"><label>${variation ? "Varyasyon adı" : "Alan başlığı"}<input name="name" required maxlength="80" value="${esc(item.name)}" placeholder="${variation ? "Örn. Nakış yeri" : "Örn. Sağ kola yazılacak isim"}" autofocus></label>${variation || type === "select" ? `<label>Seçenekler<textarea name="options" required rows="4" placeholder="Her satıra bir seçenek">${(item.options || []).map(esc).join("\n")}</textarea><small>Her satıra bir seçenek yaz. En fazla ${variation ? "30 seçenek; toplam 100 birleşim" : "30 seçenek"}.</small></label>` : ""}${!variation ? `<label>Açıklama <span class="optional-label">İsteğe bağlı</span><textarea name="instructions" rows="2" maxlength="300" placeholder="Müşterinin ne yapması gerektiğini açıkla…">${esc(item.instructions)}</textarea></label>${type === "text" ? `<label>Karakter sınırı<input name="maxLength" type="number" min="1" max="1024" required value="${item.maxLength}"></label>` : ""}${type === "file" ? `<label>En fazla fotoğraf sayısı<select name="maxFiles">${[1, 2, 3, 4, 5].map((n) => `<option ${n === item.maxFiles ? "selected" : ""}>${n}</option>`).join("")}</select><small>JPG, PNG veya WebP · Her dosya en fazla 5 MB</small></label>` : ""}<label class="checkbox-line"><input name="required" type="checkbox" ${item.required ? "checked" : ""}> Müşteri bu alanı doldurmak zorunda</label>` : '<p class="field-hint">Müşteri sepete eklerken bir seçenek seçer.</p>'}<div data-error></div><div class="taxonomy-modal-actions"><button type="button" class="button button-outline" data-action="close-modal">Vazgeç</button><button class="button button-dark">Uygula</button></div></form></div>`,
  );
  return true;
}
export function saveOption(form) {
  captureVariants();
  const data = Object.fromEntries(new FormData(form)),
    variation = form.dataset.kind === "variation",
    index = Number(form.dataset.index);
  const record = {
    id: form.dataset.optionId,
    name: data.name,
    type: form.dataset.type,
    required: data.required === "on",
    instructions: data.instructions || "",
    maxLength: Number(data.maxLength || 180),
    maxFiles: Number(data.maxFiles || 1),
    options: (data.options || "")
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean),
  };
  const next = structuredClone(draft),
    list = variation ? next.variations : next.customFields;
  if (index < 0) list.push(record);
  else list[index] = record;
  // A changed choice list invalidates the old inventory table; matching rows survive on render.
  normalizeOptions({ ...next, variants: [] });
  draft = next;
}
export function inventoryChange() {
  captureVariants();
  renderVariants();
}
export function customerOptions(product) {
  return `<div class="customer-options">${(product.variations || []).map((group) => `<label>${esc(group.name)} <span class="required-mark">*</span><select name="variation-${esc(group.id)}" data-customer-variation required><option value="">Seçim yap</option>${group.options.map((value) => `<option>${esc(value)}</option>`).join("")}</select></label>`).join("")}${fieldsFor(
    product,
  )
    .map(
      (field) =>
        `<label>${esc(field.name)} ${field.required ? '<span class="required-mark">*</span>' : '<span class="optional-label">İsteğe bağlı</span>'}${field.instructions ? `<small>${esc(field.instructions)}</small>` : ""}${field.type === "text" ? `<textarea name="custom-${esc(field.id)}" maxlength="${field.maxLength}" rows="2" ${field.required ? "required" : ""}></textarea><small>En fazla ${field.maxLength} karakter</small>` : field.type === "select" ? `<select name="custom-${esc(field.id)}" ${field.required ? "required" : ""}><option value="">Seçim yap</option>${field.options.map((value) => `<option>${esc(value)}</option>`).join("")}</select>` : `<input name="custom-${esc(field.id)}" data-custom-photo type="file" accept="image/png,image/jpeg,image/webp" ${field.maxFiles > 1 ? "multiple" : ""} ${field.required ? "required" : ""}><small>En fazla ${field.maxFiles} fotoğraf · Her biri en fazla 5 MB</small><span class="custom-photo-status" role="status"></span>`}</label>`,
    )
    .join("")}<p id="variantAvailability" role="status"></p></div>`;
}
export function selectionsHTML(item) {
  const rows = (item.optionSelections || []).map(
    (row) => `<p>${esc(row.name)}: ${esc(row.value)}</p>`,
  );
  for (const answer of item.optionAnswers || []) {
    if (answer.type === "file") {
      if (answer.value.length)
        rows.push(
          `<p>${esc(answer.name)}: ${answer.value.map((file) => (file.id.startsWith("demo-") ? `${esc(file.name)} (demo)` : `<a target="_blank" rel="noopener" href="/api/uploads/${encodeURIComponent(file.id)}">${esc(file.name)}</a>`)).join(", ")}</p>`,
        );
    } else if (answer.value)
      rows.push(`<p>${esc(answer.name)}: ${esc(answer.value)}</p>`);
  }
  return rows.join("");
}
