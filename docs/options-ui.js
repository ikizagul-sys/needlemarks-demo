import {
  fieldsFor,
  combinations,
  variantKey,
  normalizeOptions,
  scopeCombinations,
} from "./product-options.js?v=7df5bab2382c";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const uid = () => crypto.randomUUID();
const markers = {
  "right-sleeve": "Sağ kol",
  "left-sleeve": "Sol kol",
  "left-chest": "Sol göğüs",
  "center-chest": "Göğüs ortası",
  back: "Sırt",
  front: "Ön taraf",
};
const infer = (value) =>
  ({
    "sağ kol": "right-sleeve",
    "sol kol": "left-sleeve",
    "sol göğüs": "left-chest",
    "göğüs ortası": "center-chest",
    göğüs: "center-chest",
    sırt: "back",
  })[value.toLocaleLowerCase("tr")] || "front";
let draft, manager, base;
const labels = {
  price: "Fiyatlar farklı",
  stock: "Stoklar farklı",
  sku: "Ürün kodları farklı",
};
const blankRules = () =>
  Object.fromEntries(
    Object.keys(labels).map((type) => [
      type,
      { enabled: false, scope: "*", values: [] },
    ]),
  );
function migrate(product) {
  const variations = structuredClone(product.variations || []).map((group) => ({
    ...group,
    kind:
      group.kind ||
      (/nakış|konum|yer/i.test(group.name) ? "placement" : "custom"),
    markers:
      group.markers ||
      Object.fromEntries(group.options.map((value) => [value, infer(value)])),
  }));
  if (!product.managedVariations && !product.variants?.length) {
    for (const [kind, name, options] of [
      ["size", "Beden", product.sizes],
      ["color", "Renk", product.colors],
    ]) {
      if (
        options?.length > 1 &&
        !variations.some((group) => group.kind === kind) &&
        variations.length < 3 &&
        variations.reduce((n, g) => n * g.options.length, options.length) <= 400
      )
        variations.push({
          id: "base-" + kind,
          name,
          kind,
          options: [...options],
        });
    }
  }
  let variationRules = structuredClone(product.variationRules || blankRules());
  if (!product.variationRules && product.variants?.length) {
    for (const type of ["price", "stock"])
      variationRules[type] = {
        enabled: true,
        scope: "*",
        values: combinations(variations).map((values) => {
          const old = product.variants.find(
            (row) =>
              row.key ===
              variantKey(values.slice(0, product.variations.length)),
          );
          return {
            key: variantKey(values),
            value: old?.[type] ?? product[type],
          };
        }),
      };
    // Existing inventory belongs to the original groups; avoid duplicating it across imported sizes/colors.
    if (variations.length !== (product.variations || []).length) {
      variations.splice(product.variations.length);
    }
  }
  return {
    variations,
    variationRules,
    variants: [],
    customFields: structuredClone(fieldsFor(product)),
    managedVariations:
      product.managedVariations === true || !product.variants?.length,
    sku: product.sku || "",
  };
}
export function optionsEditor(product) {
  draft = migrate(product);
  manager = null;
  base = { price: product.price || 100, stock: product.stock || 0 };
  return `<section class="editor-card item-options"><div class="editor-card-heading"><div><h2>Ürün seçenekleri</h2><p>Her ürün için sadece ihtiyacın olan seçimleri ekle.</p></div></div><div class="option-section"><div class="editor-card-heading"><div><h3>Varyasyonlar</h3><p>Beden, renk veya nakış konumu.</p></div><button type="button" class="button button-outline" data-manage-variations>Varyasyonları yönet</button></div><div id="variationRows"></div><p class="field-hint">Varyasyon eklemezsen müşteri bu üründe seçim yapmaz.</p></div><div class="option-section"><div class="editor-card-heading"><div><h3>Kişiselleştirme alanları</h3><p>İsim, fotoğraf veya özel not al.</p></div><button type="button" class="button button-outline" data-option-add="field">＋ Alan ekle</button></div><div id="customFieldRows"></div><small>En fazla 5 alan. Bu alanlar stok miktarını değiştirmez.</small></div></section>`;
}
export function renderOptions() {
  const container = document.querySelector("#variationRows");
  if (!container) return;
  container.innerHTML =
    draft.variations
      .map(
        (group) =>
          `<div class="variation-summary"><strong>${esc(group.name)}</strong><span>${group.options.map((value) => `<span class="variation-chip">${esc(value)}</span>`).join("")}</span></div>`,
      )
      .join("") || '<p class="options-empty">Bu üründe varyasyon yok.</p>';
  document.querySelector("#customFieldRows").innerHTML =
    draft.customFields
      .map(
        (field, i) =>
          `<div class="option-row"><span class="option-type-icon">${{ text: "T", file: "▧", select: "☷" }[field.type]}</span><div><strong>${esc(field.name)}</strong><p>${field.required ? "Zorunlu" : "İsteğe bağlı"} · ${{ text: `Metin · ${field.maxLength} karakter`, file: `Fotoğraf · En fazla ${field.maxFiles} dosya`, select: `Seçim listesi · ${field.options?.length} seçenek` }[field.type]}</p></div><button type="button" data-option-edit="field" data-index="${i}">Düzenle</button><button type="button" data-option-remove="field" data-index="${i}" aria-label="${esc(field.name)} sil">Sil</button></div>`,
      )
      .join("") ||
    '<p class="options-empty">Müşteriden ek bilgi istemiyorsan boş bırakabilirsin.</p>';
  document.querySelector('[data-option-add="field"]').disabled =
    draft.customFields.length >= 5;
}
function resetRules() {
  for (const type of Object.keys(labels)) {
    const rule = manager.variationRules[type] || {
      enabled: false,
      scope: "*",
      values: [],
    };
    if (
      rule.scope !== "*" &&
      !manager.variations.some((group) => group.id === rule.scope)
    )
      rule.scope = "*";
    const keys = scopeCombinations(manager.variations, rule.scope).map(
      variantKey,
    );
    rule.values = rule.enabled
      ? keys.map(
          (key) =>
            rule.values.find((entry) => entry.key === key) || {
              key,
              value: type === "sku" ? "" : base[type],
            },
        )
      : [];
    if (!manager.variations.length) rule.enabled = false;
    manager.variationRules[type] = rule;
  }
}
function captureRules() {
  if (!manager) return;
  for (const input of document.querySelectorAll("[data-rule-value]")) {
    const entry = manager.variationRules[input.dataset.ruleValue].values.find(
      (entry) => entry.key === input.dataset.ruleKey,
    );
    if (entry)
      entry.value =
        input.dataset.ruleValue === "sku"
          ? input.value
          : input.dataset.ruleValue === "price"
            ? Math.round(Number(input.value) * 100)
            : Number(input.value);
  }
}
function managerMarkup() {
  resetRules();
  return `<div class="variation-manager"><div class="eyebrow">ÜRÜNE ÖZEL SEÇİMLER</div><h2>Varyasyonları yönet</h2><p class="manager-intro">Grupları ve seçeneklerini belirle. Bu ayarlar yalnızca bu ürün için geçerli.</p><form data-form="variation-manager"><div class="variation-group-list">${manager.variations.map((group, i) => `<article class="variation-group-card"><div><h3>${esc(group.name)}</h3><p>${group.options.length} seçenek${group.kind === "placement" ? " · Müşteriye görselli kartlar" : ""}</p><div class="variation-chips">${group.options.map((value) => `<span class="variation-chip">${esc(value)}</span>`).join("")}</div></div><div class="variation-card-actions"><button type="button" data-option-edit="variation" data-index="${i}" aria-label="${esc(group.name)} düzenle">✎</button><button type="button" data-option-remove="variation" data-index="${i}" aria-label="${esc(group.name)} sil">×</button></div></article>`).join("") || '<div class="variation-empty"><h3>Bu üründe varyasyon yok.</h3><p>İstersen beden, renk veya nakış konumu ekle. İstemiyorsan boş bırak.</p></div>'}</div><button type="button" class="button button-outline add-variation-button" data-option-add="variation" ${manager.variations.length >= 3 ? "disabled" : ""}>＋ Varyasyon ekle</button><div class="variation-rules">${Object.entries(
    labels,
  )
    .map(([type, title]) => {
      const rule = manager.variationRules[type];
      return `<div class="variation-rule"><div class="variation-rule-heading"><label class="switch-label"><input type="checkbox" role="switch" data-rule-toggle="${type}" ${rule.enabled ? "checked" : ""} ${!manager.variations.length ? "disabled" : ""}><span class="switch-track" aria-hidden="true"></span><strong>${title}</strong></label>${rule.enabled ? `<label class="rule-scope-label"><span class="visually-hidden">${title}: hangi gruba göre?</span><select data-rule-scope="${type}"><option value="*">Tüm grupların birleşimi</option>${manager.variations.map((group) => `<option value="${esc(group.id)}" ${rule.scope === group.id ? "selected" : ""}>Yalnızca ${esc(group.name)}</option>`).join("")}</select></label>` : `<small>${type === "price" ? "Ürünün ortak fiyatı kullanılır." : type === "stock" ? "Ürünün ortak stoku kullanılır." : "Ortak ürün kodu kullanılır."}</small>`}</div>${rule.enabled ? `<div class="table-scroll rule-table-wrap"><table class="rule-table"><thead><tr><th>${rule.scope === "*" ? "Birleşim" : esc(manager.variations.find((g) => g.id === rule.scope)?.name)}</th><th>${type === "price" ? "Fiyat (₺)" : type === "stock" ? "Stok adedi" : "Ürün kodu (SKU)"}</th></tr></thead><tbody>${rule.values.map((entry) => `<tr><td>${JSON.parse(entry.key).map(esc).join(" / ")}</td><td><input data-rule-value="${type}" data-rule-key="${esc(entry.key)}" aria-label="${esc(JSON.parse(entry.key).join(" / "))} ${type === "price" ? "fiyat" : type === "stock" ? "stok" : "ürün kodu"}" ${type === "sku" ? `maxlength="80" placeholder="Örn. NM-TS-M-SY"` : `type="number" required min="${type === "price" ? "0.01" : "0"}" max="${type === "price" ? "1000000" : "100000"}" step="${type === "price" ? "0.01" : "1"}"`} value="${esc(type === "price" ? entry.value / 100 : entry.value)}"></td></tr>`).join("")}</tbody></table></div>` : ""}</div>`;
    })
    .join(
      "",
    )}</div><p class="manager-footnote">En fazla 3 grup ve 400 birleşim. Ana ürün stoku toplam sınırdır. İsim ve fotoğraf alanlarını ayrı Kişiselleştirme bölümünden yönetebilirsin.</p><div data-error></div><div class="manager-save"><button type="button" class="button button-outline" data-action="close-modal">Vazgeç</button><button class="button button-dark">Ürüne uygula</button></div></form></div>`;
}
export function showVariationManager(modal, start = false) {
  if (start) {
    manager = structuredClone(draft);
    const form = document.querySelector('[data-form="product-admin"]');
    base = {
      price: Math.round(Number(form.elements.price.value) * 100) || 100,
      stock: Number(form.elements.stock.value) || 0,
    };
  }
  modal(managerMarkup());
}
export function saveManager() {
  captureRules();
  draft = normalizeOptions({
    ...manager,
    managedVariations:
      manager.managedVariations || manager.variations.length === 0,
    sku: document.querySelector('[name="sku"]')?.value || "",
  });
  manager = null;
}
export function readOptions() {
  return normalizeOptions({
    ...draft,
    sku:
      document.querySelector('[data-form="product-admin"] [name="sku"]')
        ?.value || "",
  });
}
function groupEditor(record, index, modal) {
  const group = record || {
    id: uid(),
    name: "",
    kind: "custom",
    options: [],
    markers: {},
  };
  modal(
    `<div class="option-modal group-editor"><div class="eyebrow">VARYASYON GRUBU</div><h2>${record ? "Grubu düzenle" : "Yeni varyasyon"}</h2><form data-form="option-editor" data-kind="variation" data-index="${index}" data-option-id="${esc(group.id)}"><label>Grup türü<select name="kind" data-group-kind>${[
      ["custom", "Kendim oluşturacağım"],
      ["size", "Beden"],
      ["color", "Renk"],
      ["placement", "Nakış konumu (görselli)"],
    ]
      .map(
        ([value, label]) =>
          `<option value="${value}" ${value === group.kind ? "selected" : ""}>${label}</option>`,
      )
      .join(
        "",
      )}</select></label><label>Varyasyon adı<input name="name" value="${esc(group.name)}" required maxlength="80" placeholder="Örn. Nakış yapılacak yer"></label><label>Seçenekler<textarea name="options" data-group-options rows="5" required placeholder="Her satıra bir seçenek">${group.options.map(esc).join("\n")}</textarea><small>Her satıra bir seçenek yaz. Başlıkları istediğin gibi değiştirebilirsin.</small></label><div id="placementMarkerEditor"></div><div data-error></div><div class="taxonomy-modal-actions"><button type="button" class="button button-outline" data-manager-back>Geri</button><button class="button button-dark">Grubu uygula</button></div></form></div>`,
  );
  renderMarkerEditor(group.markers);
}
function renderMarkerEditor(previous = {}) {
  const form = document.querySelector(".group-editor form");
  if (!form) return;
  const container = document.querySelector("#placementMarkerEditor");
  if (form.elements.kind.value !== "placement") {
    container.innerHTML = "";
    return;
  }
  const old = Object.fromEntries(
    [...container.querySelectorAll("[data-position-marker]")].map((select) => [
      select.dataset.positionMarker,
      select.value,
    ]),
  );
  const options = form.elements.options.value
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);
  container.innerHTML = `<h3>Görsellerde gösterilecek konum</h3><p class="field-hint">Her seçeneğin tişört çiziminde nereye işaret edeceğini seç.</p>${options
    .map(
      (value) =>
        `<label class="marker-edit-row"><span>${esc(value)}</span><select data-position-marker="${esc(value)}">${Object.entries(
          markers,
        )
          .map(
            ([key, title]) =>
              `<option value="${key}" ${key === (old[value] || previous[value] || infer(value)) ? "selected" : ""}>${title}</option>`,
          )
          .join("")}</select></label>`,
    )
    .join("")}`;
}
export function optionChange(target, modal) {
  if (target.matches("[data-rule-toggle],[data-rule-scope]")) {
    captureRules();
    const type = target.dataset.ruleToggle || target.dataset.ruleScope,
      rule = manager.variationRules[type];
    if (target.dataset.ruleToggle) rule.enabled = target.checked;
    else {
      rule.scope = target.value;
      rule.values = [];
    }
    showVariationManager(modal);
    return true;
  }
  if (target.matches("[data-group-kind]")) {
    const form = target.closest("form"),
      presets = {
        size: ["Beden", ["XS", "S", "M", "L", "XL", "2XL"]],
        color: ["Renk", ["Siyah", "Beyaz", "Krem"]],
        placement: [
          "Nakış konumu",
          ["Sağ kol", "Sol kol", "Sol göğüs", "Göğüs ortası"],
        ],
        custom: ["", []],
      };
    const [name, options] = presets[target.value];
    form.elements.name.value = name;
    form.elements.options.value = options.join("\n");
    renderMarkerEditor();
    return true;
  }
  if (target.matches("[data-group-options]")) renderMarkerEditor();
  return false;
}
export function optionAction(target, modal, closeModal) {
  const button = target.closest(
    "[data-manage-variations],[data-manager-back],[data-option-add],[data-option-edit],[data-option-remove],[data-field-type]",
  );
  if (!button) return false;
  if (button.hasAttribute("data-manage-variations")) {
    showVariationManager(modal, true);
    return true;
  }
  if (button.hasAttribute("data-manager-back")) {
    showVariationManager(modal);
    return true;
  }
  const kind =
      button.dataset.optionAdd ||
      button.dataset.optionEdit ||
      button.dataset.optionRemove,
    index = Number(button.dataset.index),
    variation = kind === "variation";
  if (variation) {
    captureRules();
    if (button.dataset.optionRemove) {
      manager.variations.splice(index, 1);
      showVariationManager(modal);
    } else
      groupEditor(
        button.dataset.optionEdit ? manager.variations[index] : null,
        button.dataset.optionEdit ? index : -1,
        modal,
      );
    return true;
  }
  manager = null;
  if (button.dataset.optionRemove) {
    draft.customFields.splice(index, 1);
    renderOptions();
    return true;
  }
  if (button.dataset.optionAdd === "field") {
    modal(
      `<div class="option-modal"><div class="eyebrow">YENİ ALAN OLUŞTUR</div><h2>Hangi bilgiye ihtiyacın var?</h2><div class="field-type-list"><button data-field-type="text"><b>T</b><span>Metin kutusu<small>İsimler, tarihler veya kısa notlar</small></span>＋</button><button data-field-type="file"><b>▧</b><span>Fotoğraf yükleme<small>Evcil hayvan fotoğrafı, logo veya örnek</small></span>＋</button><button data-field-type="select"><b>☷</b><span>Seçenek listesi<small>İplik rengi, yazı tipi veya nakış konumu</small></span>＋</button></div><button class="text-link" data-action="close-modal">Vazgeç</button></div>`,
    );
    return true;
  }
  const record = button.dataset.optionEdit ? draft.customFields[index] : null,
    type = button.dataset.fieldType || record?.type;
  const item = record || {
    id: uid(),
    name: "",
    type,
    required: true,
    options: [],
    instructions: "",
    maxLength: 180,
    maxFiles: 1,
  };
  modal(
    `<div class="option-modal"><div class="eyebrow">KİŞİSELLEŞTİRME</div><h2>${record ? "Alanı düzenle" : "Alan ekle"}</h2><form data-form="option-editor" data-kind="field" data-index="${record ? index : -1}" data-option-id="${esc(item.id)}" data-type="${esc(type)}"><label>Alan başlığı<input name="name" required maxlength="80" value="${esc(item.name)}" placeholder="Örn. Sağ kola yazılacak isim" autofocus></label>${type === "select" ? `<label>Seçenekler<textarea name="options" required rows="4" placeholder="Her satıra bir seçenek">${(item.options || []).map(esc).join("\n")}</textarea></label>` : ""}<label>Açıklama <span class="optional-label">İsteğe bağlı</span><textarea name="instructions" rows="2" maxlength="300">${esc(item.instructions)}</textarea></label>${type === "text" ? `<label>Karakter sınırı<input name="maxLength" type="number" min="1" max="1024" required value="${item.maxLength}"></label>` : ""}${type === "file" ? `<label>En fazla fotoğraf sayısı<select name="maxFiles">${[1, 2, 3, 4, 5].map((n) => `<option ${n === item.maxFiles ? "selected" : ""}>${n}</option>`).join("")}</select><small>JPG, PNG veya WebP · Her dosya en fazla 5 MB</small></label>` : ""}<label class="checkbox-line"><input name="required" type="checkbox" ${item.required ? "checked" : ""}> Müşteri bu alanı doldurmak zorunda</label><div data-error></div><div class="taxonomy-modal-actions"><button type="button" class="button button-outline" data-action="close-modal">Vazgeç</button><button class="button button-dark">Uygula</button></div></form></div>`,
  );
  return true;
}
export function saveOption(form) {
  const data = Object.fromEntries(new FormData(form)),
    variation = form.dataset.kind === "variation",
    index = Number(form.dataset.index);
  const record = {
    id: form.dataset.optionId,
    name: data.name,
    kind: data.kind,
    type: form.dataset.type,
    required: data.required === "on",
    instructions: data.instructions || "",
    maxLength: Number(data.maxLength || 180),
    maxFiles: Number(data.maxFiles || 1),
    options: (data.options || "")
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean),
    markers: Object.fromEntries(
      [...form.querySelectorAll("[data-position-marker]")].map((select) => [
        select.dataset.positionMarker,
        select.value,
      ]),
    ),
  };
  const next = structuredClone(variation ? manager : draft),
    list = variation ? next.variations : next.customFields;
  if (index < 0) list.push(record);
  else list[index] = record;
  normalizeOptions({ ...next, variants: [], variationRules: undefined });
  if (variation) manager = next;
  else draft = next;
}
function shirtSVG(marker) {
  const points = {
      "right-sleeve": [24, 37],
      "left-sleeve": [96, 37],
      "left-chest": [73, 53],
      "center-chest": [60, 59],
      back: [60, 65],
      front: [60, 57],
    },
    [x, y] = points[marker] || points.front;
  return `<svg class="placement-shirt" viewBox="0 0 120 120" aria-hidden="true"><path d="M43 15 21 24 9 48 30 58 35 47 35 105 85 105 85 47 90 58 111 48 99 24 77 15C72 30 48 30 43 15Z" fill="${marker === "back" ? "#ecebe6" : "#faf9f5"}" stroke="currentColor" stroke-width="2"/><path d="M45 16Q60 39 75 16" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="${x}" cy="${y}" r="13" fill="#536751" opacity=".15"/><circle cx="${x}" cy="${y}" r="5" fill="#536751"/>${marker === "back" ? '<text x="60" y="93" text-anchor="middle" font-size="9" fill="currentColor">ARKA</text>' : ""}</svg>`;
}
function customerGroup(group) {
  if (group.kind === "placement")
    return `<fieldset class="placement-fieldset"><legend>${esc(group.name)} <span class="required-mark">*</span></legend><p class="field-hint">Nakışın yapılmasını istediğin yeri seç.</p><div class="placement-grid">${group.options.map((value) => `<label class="placement-choice"><input type="radio" name="variation-${esc(group.id)}" value="${esc(value)}" data-customer-variation required><span>${shirtSVG(group.markers?.[value] || infer(value))}<strong>${esc(value)}</strong></span></label>`).join("")}</div></fieldset>`;
  return `<label>${esc(group.name)} <span class="required-mark">*</span><select name="variation-${esc(group.id)}" data-customer-variation required><option value="">Seçim yap</option>${group.options.map((value) => `<option>${esc(value)}</option>`).join("")}</select></label>`;
}

export function customerOptions(product) {
  return `<div class="customer-options">${(product.variations || []).map(customerGroup).join("")}${fieldsFor(
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
