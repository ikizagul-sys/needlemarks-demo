import { colorHex, validHex, reorderOptions } from "./variation-media.js?v=196d1669caaa";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const positions = {
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
    sırt: "back",
  })[value.toLocaleLowerCase("tr")] || "front";
let edit, picker, dragIndex;
function readRows() {
  const form = document.querySelector("[data-group-editor]");
  if (!form) return;
  edit.name = form.elements.name.value;
  edit.kind = form.elements.kind.value;
  edit.linkPhotos = form.elements.linkPhotos.checked;
  edit.allowExtras = form.elements.allowExtras?.checked === true;
  edit.rows = [...form.querySelectorAll("[data-option-row]")].map(
    (row, index) => ({
      ...edit.rows[index],
      name: row.querySelector("[data-option-name]").value.trim(),
      extra:
        row.querySelector("[data-extra-enabled]")?.checked ??
        edit.rows[index].extra,
      extraPrice: row.querySelector("[data-extra-price]")
        ? Math.round(
            Number(row.querySelector("[data-extra-price]").value) * 100,
          )
        : edit.rows[index].extraPrice,
      hex:
        row.querySelector("[data-option-hex]")?.value || edit.rows[index].hex,
      marker:
        row.querySelector("[data-option-marker]")?.value ||
        edit.rows[index].marker,
    }),
  );
}
function draw(modal, focusIndex) {
  modal(
    `<div class="option-modal group-editor"><div class="eyebrow">VARYASYON GRUBU</div><h2>${edit.index < 0 ? "Varyasyon ekle" : "Varyasyonu düzenle"}</h2><form data-form="option-editor" data-kind="variation" data-group-editor data-index="${edit.index}" data-option-id="${esc(edit.id)}"><div class="form-grid"><label>Grup türü<select name="kind" data-rich-kind>${[
      ["custom", "Kendim oluşturacağım"],
      ["color", "Renk"],
      ["size", "Beden"],
      ["placement", "Nakış konumu"],
    ]
      .map(
        ([value, title]) =>
          `<option value="${value}" ${value === edit.kind ? "selected" : ""}>${title}</option>`,
      )
      .join(
        "",
      )}</select></label><label>Varyasyon adı<input name="name" required maxlength="80" value="${esc(edit.name)}" placeholder="Örn. Renkler"></label></div><label class="checkbox-line"><input name="linkPhotos" type="checkbox" data-link-photos ${edit.linkPhotos ? "checked" : ""}> Bu varyasyona fotoğraf bağla</label>${edit.kind === "placement" ? `<label class="checkbox-line"><input name="allowExtras" type="checkbox" data-allow-extras ${edit.allowExtras ? "checked" : ""}> Ana konuma ek nakış konumları sun</label>${edit.allowExtras ? '<p class="field-hint">Müşteri önce ana konumu seçer. Aşağıda işaretlediğin ek konumları da seçebilir; ücret ana ürün fiyatına eklenir.</p>' : ""}` : ""}<p class="field-hint">Seçenekleri tutamaçtan sürükleyebilir veya oklarla sıralayabilirsin.</p><div class="rich-option-list">${edit.rows
      .map(
        (row, index) =>
          `<div class="rich-option-row" data-option-row="${index}"><button type="button" draggable="true" class="option-grip" data-option-grip="${index}" aria-label="${esc(row.name || "Seçenek")} sıralama tutamacı">⠿</button><span class="option-preview" style="--option-color:${colorHex(row.name, row.hex)}">${row.photos[0] ? `<img src="${esc(row.photos[0])}" alt="">` : ""}</span><div class="option-row-main"><input data-option-name aria-label="${index + 1}. seçenek adı" required maxlength="80" value="${esc(row.name)}">${edit.kind === "color" ? `<div class="option-hex-controls"><input type="color" data-option-color aria-label="${esc(row.name)} renk seçici" value="${colorHex(row.name, row.hex)}"><input data-option-hex aria-label="${esc(row.name)} HEX" pattern="#[A-Fa-f0-9]{6}" maxlength="7" required value="${esc(row.hex)}"></div>` : ""}${
            edit.kind === "placement"
              ? `<select data-option-marker aria-label="${esc(row.name)} görsel konumu">${Object.entries(
                  positions,
                )
                  .map(
                    ([key, title]) =>
                      `<option value="${key}" ${key === row.marker ? "selected" : ""}>${title}</option>`,
                  )
                  .join("")}</select>`
              : ""
          }${edit.kind === "placement" && edit.allowExtras ? `<div class="extra-placement-controls"><label><input type="checkbox" data-extra-enabled ${row.extra ? "checked" : ""}> Ek nakış olarak sun</label><label>Ek ücret (₺ / ürün)<input type="number" data-extra-price min="0" max="1000000" step="0.01" required value="${(row.extraPrice || 0) / 100}" aria-label="${esc(row.name)} ek nakış ücreti"></label></div>` : ""}${edit.linkPhotos ? `<button type="button" class="option-photo-link" data-option-photos="${index}">${row.photos.length ? row.photos.length + " fotoğraf bağlı" : "Fotoğraf bağla"}</button>` : ""}</div><div class="option-order-controls"><button type="button" data-option-move="${index}" data-direction="-1" ${index === 0 ? "disabled" : ""} aria-label="${esc(row.name)} yukarı taşı">↑</button><button type="button" data-option-move="${index}" data-direction="1" ${index === edit.rows.length - 1 ? "disabled" : ""} aria-label="${esc(row.name)} aşağı taşı">↓</button></div><button type="button" class="option-delete" data-option-delete="${index}" aria-label="${esc(row.name)} seçeneğini sil">×</button></div>`,
      )
      .join(
        "",
      )}</div><div class="option-add-row"><label class="visually-hidden" for="newVariationOption">Yeni seçenek</label><input id="newVariationOption" placeholder="Yeni seçenek adı · Örn. Mavi" maxlength="80"><button type="button" class="button button-outline" data-option-append ${edit.rows.length >= 30 ? "disabled" : ""}>＋ Ekle</button></div><div data-error></div><div class="taxonomy-modal-actions"><button type="button" class="button button-outline" data-manager-back>Geri</button><button class="button button-dark">Tamam</button></div></form></div>`,
  );
  if (focusIndex !== undefined)
    document
      .querySelector(`[data-option-row="${focusIndex}"] [data-option-name]`)
      ?.focus();
}
export function openGroupEditor(group, index, modal, images) {
  const record = group || {
    id: crypto.randomUUID(),
    name: "",
    kind: "custom",
    options: [],
  };
  edit = {
    ...record,
    index,
    images,
    rows: record.options.map((name) => ({
      name,
      original: name,
      extra: record.extraOptions?.includes(name) || false,
      extraPrice: record.extraPrices?.[name] || 0,
      hex: colorHex(name, record.swatches?.[name]),
      photos: [...(record.photos?.[name] || [])].filter((image) =>
        images.includes(image),
      ),
      marker: record.markers?.[name] || infer(name),
    })),
  };
  draw(modal);
}
export function readEditedGroup() {
  readRows();
  const names = edit.rows.map((row) => row.name);
  if (!names.length || names.some((name) => !name))
    throw new Error("En az bir seçenek ekle ve boş adları doldur.");
  if (
    new Set(names.map((name) => name.toLocaleLowerCase("tr"))).size !==
    names.length
  )
    throw new Error("Seçenek adları birbirinden farklı olmalı.");
  if (edit.rows.some((row) => !validHex(row.hex)))
    throw new Error("Geçerli bir HEX renk değeri gir.");
  return {
    id: edit.id,
    name: edit.name,
    kind: edit.kind,
    linkPhotos: edit.linkPhotos === true,
    allowExtras: edit.kind === "placement" && edit.allowExtras === true,
    extraOptions: edit.rows.filter((row) => row.extra).map((row) => row.name),
    extraPrices: Object.fromEntries(
      edit.rows.map((row) => [row.name, row.extraPrice || 0]),
    ),
    options: names,
    swatches: Object.fromEntries(edit.rows.map((row) => [row.name, row.hex])),
    photos: Object.fromEntries(edit.rows.map((row) => [row.name, row.photos])),
    markers: Object.fromEntries(edit.rows.map((row) => [row.name, row.marker])),
    renames: Object.fromEntries(
      edit.rows
        .filter((row) => row.original && row.original !== row.name)
        .map((row) => [row.original, row.name]),
    ),
  };
}
export function choosePhotos(images, selected, modal, onDone, onCancel) {
  picker = {
    images,
    selected: new Set(selected.filter((image) => images.includes(image))),
    onDone,
    onCancel,
  };
  modal(
    `<div class="variation-photo-picker"><div class="eyebrow">ÜRÜN GALERİSİ</div><h2>Fotoğrafları bağla</h2><p>Bir veya birden fazla fotoğraf seç. Seçim boşsa varsayılan galeri kullanılır.</p><div class="variation-photo-grid">${images.map((image, index) => `<label><input type="checkbox" data-photo-choice="${index}" ${picker.selected.has(image) ? "checked" : ""}><span><img src="${esc(image)}" alt="Ürün fotoğrafı ${index + 1}"><small>${index + 1}. fotoğraf</small></span></label>`).join("") || "<p>Önce ürünün Fotoğraflar alanına görsel ekle.</p>"}</div><div class="taxonomy-modal-actions"><button type="button" class="button button-outline" data-photo-cancel>Vazgeç</button><button type="button" class="button button-dark" data-photo-done>Fotoğrafları uygula</button></div></div>`,
  );
}
export function editorInput(target) {
  const row = target.closest("[data-option-row]");
  if (!row) return false;
  const index = Number(row.dataset.optionRow),
    item = edit.rows[index];
  if (target.matches("[data-option-color]"))
    row.querySelector("[data-option-hex]").value = target.value;
  if (target.matches("[data-option-name]")) {
    const current = row.querySelector("[data-option-hex]");
    if (current && current.value === colorHex(item.name)) {
      current.value = colorHex(target.value);
      row.querySelector("[data-option-color]").value = current.value;
    }
    item.name = target.value.trim();
  }
  const hex =
    row.querySelector("[data-option-hex]")?.value || colorHex(target.value);
  if (validHex(hex)) {
    row
      .querySelector(".option-preview")
      .style.setProperty("--option-color", hex);
    const color = row.querySelector("[data-option-color]");
    if (color) color.value = hex;
  }
  return true;
}
export function editorChange(target, modal) {
  if (target.matches("[data-photo-choice]")) {
    const image = picker.images[Number(target.dataset.photoChoice)];
    if (target.checked) picker.selected.add(image);
    else picker.selected.delete(image);
    return true;
  }
  if (
    target.matches("[data-rich-kind],[data-link-photos],[data-allow-extras]")
  ) {
    readRows();
    draw(modal);
    return true;
  }
  return editorInput(target);
}
export function editorAction(target, modal) {
  const button = target.closest(
    "[data-option-append],[data-option-delete],[data-option-move],[data-option-photos],[data-photo-cancel],[data-photo-done]",
  );
  if (!button) return false;
  if (button.hasAttribute("data-photo-cancel")) {
    const p = picker;
    picker = null;
    p.onCancel();
    return true;
  }
  if (button.hasAttribute("data-photo-done")) {
    const p = picker;
    picker = null;
    p.onDone(p.images.filter((image) => p.selected.has(image)));
    return true;
  }
  readRows();
  if (button.hasAttribute("data-option-photos")) {
    const index = Number(button.dataset.optionPhotos);
    choosePhotos(
      edit.images,
      edit.rows[index].photos,
      modal,
      (photos) => {
        edit.rows[index].photos = photos;
        draw(modal);
      },
      () => draw(modal),
    );
    return true;
  }
  let focus;
  if (button.hasAttribute("data-option-append")) {
    const name = document.querySelector("#newVariationOption").value.trim();
    const error = document.querySelector("[data-group-editor] [data-error]");
    if (
      !name ||
      edit.rows.some(
        (row) =>
          row.name.toLocaleLowerCase("tr") === name.toLocaleLowerCase("tr"),
      ) ||
      edit.rows.length >= 30
    ) {
      error.textContent =
        "Farklı bir seçenek adı gir. En fazla 30 seçenek eklenebilir.";
      return true;
    }
    edit.rows.push({
      name,
      original: null,
      hex: colorHex(name),
      photos: [],
      marker: infer(name),
    });
    focus = edit.rows.length - 1;
  } else if (button.hasAttribute("data-option-delete"))
    edit.rows.splice(Number(button.dataset.optionDelete), 1);
  else {
    const from = Number(button.dataset.optionMove),
      to = from + Number(button.dataset.direction);
    edit.rows = reorderOptions(edit.rows, from, to);
    focus = to;
  }
  draw(modal, focus);
  return true;
}
export function editorDrag(event, modal) {
  if (event.type === "dragstart") {
    const grip = event.target.closest("[data-option-grip]");
    if (!grip) return;
    readRows();
    dragIndex = Number(grip.dataset.optionGrip);
    event.dataTransfer.setData("application/x-nm-option", String(dragIndex));
    event.dataTransfer.effectAllowed = "move";
    return;
  }
  const row = event.target.closest("[data-option-row]");
  if (
    !row ||
    ![...event.dataTransfer.types].includes("application/x-nm-option")
  )
    return;
  event.preventDefault();
  if (event.type === "drop") {
    const to = Number(row.dataset.optionRow);
    edit.rows = reorderOptions(edit.rows, dragIndex, to);
    draw(modal, to);
    dragIndex = undefined;
  }
}
