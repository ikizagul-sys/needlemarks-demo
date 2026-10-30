// Shared by the storefront, demo and SQLite server.
const fail = (message) => {
  throw new Error(message);
};
const text = (value, limit) =>
  typeof value === "string" && value.trim().length <= limit
    ? value.trim()
    : fail("Seçenek metnini kontrol et.");
const number = (value, min, max) =>
  Number.isInteger(value) && value >= min && value <= max
    ? value
    : fail("Seçenek fiyatını veya stok miktarını kontrol et.");
export const variantKey = (values) => JSON.stringify(values);
export function combinations(groups) {
  return groups.reduce(
    (rows, group) =>
      rows.flatMap((row) => group.options.map((value) => [...row, value])),
    [[]],
  );
}
const legacyFields = [
  {
    id: "photo",
    name: "Fotoğrafın",
    type: "file",
    required: false,
    instructions: "JPG, PNG veya WebP · En fazla 5 MB",
    maxFiles: 1,
  },
  {
    id: "note",
    name: "İsim, tarih veya küçük bir not",
    type: "text",
    required: false,
    instructions: "Örneğin: Milo · 2024",
    maxLength: 180,
  },
];
export const fieldsFor = (product) => product.customFields ?? legacyFields;
export function normalizeOptions(product) {
  const unique = (rows, key) => {
    if (
      new Set(rows.map((row) => row[key].toLocaleLowerCase("tr"))).size !==
      rows.length
    )
      fail("Alan adları ve kimlikleri birbirinden farklı olmalı.");
  };
  const choices = (values) => {
    if (!Array.isArray(values) || !values.length || values.length > 30)
      fail("1–30 seçenek ekle.");
    const result = values.map((value) => text(value, 80));
    if (
      result.some((value) => !value) ||
      new Set(result.map((value) => value.toLocaleLowerCase("tr"))).size !==
        result.length
    )
      fail("Boş veya tekrarlanan seçenekleri kaldır.");
    return result;
  };
  const groups = product.variations ?? [];
  if (!Array.isArray(groups) || groups.length > 2)
    fail("En fazla 2 varyasyon grubu eklenebilir.");
  const variations = groups.map((group) => ({
    id: text(group.id, 80),
    name: text(group.name, 80),
    options: choices(group.options),
  }));
  for (const row of variations)
    if (!/^[\w-]+$/.test(row.id) || !row.name) fail("Varyasyon adını doldur.");
  unique(variations, "id");
  unique(variations, "name");
  if (combinations(variations).length > 100)
    fail("En fazla 100 varyasyon birleşimi oluşturulabilir.");
  const rows = product.variants ?? [];
  if (!Array.isArray(rows)) fail("Varyasyon tablosu geçersiz.");
  const keys = variations.length
    ? combinations(variations).map(variantKey)
    : [];
  if (
    rows.length &&
    (rows.length !== keys.length ||
      new Set(rows.map((row) => row.key)).size !== keys.length)
  )
    fail("Varyasyon tablosunu yeniden oluştur.");
  const variants = rows.map((row) => {
    if (!keys.includes(row.key)) fail("Varyasyon tablosunu yeniden oluştur.");
    return {
      key: row.key,
      price: number(row.price, 1, 100000000),
      stock: number(row.stock, 0, 100000),
    };
  });
  const source = fieldsFor(product);
  if (!Array.isArray(source) || source.length > 5)
    fail("En fazla 5 kişiselleştirme alanı eklenebilir.");
  const customFields = source.map((field) => {
    const result = {
      id: text(field.id, 80),
      name: text(field.name, 80),
      type: field.type,
      required: field.required === true,
      instructions: text(field.instructions ?? "", 300),
    };
    if (
      !/^[\w-]+$/.test(result.id) ||
      !result.name ||
      !["text", "select", "file"].includes(result.type)
    )
      fail("Kişiselleştirme alanını kontrol et.");
    if (result.type === "text")
      result.maxLength = number(field.maxLength ?? 180, 1, 1024);
    if (result.type === "file")
      result.maxFiles = number(field.maxFiles ?? 1, 1, 5);
    if (result.type === "select") result.options = choices(field.options);
    return result;
  });
  unique(customFields, "id");
  unique(customFields, "name");
  return { variations, variants, customFields };
}
export function selectedVariant(product, selected = {}) {
  const values = (product.variations || []).map((group) => {
    const value = selected?.[group.id];
    if (!group.options.includes(value))
      fail(
        `${group.name} seçimini yap veya ürünü sepetten kaldırıp yeniden ekle.`,
      );
    return value;
  });
  const key = values.length ? variantKey(values) : "";
  const row = product.variants?.find((row) => row.key === key);
  if (product.variants?.length && !row)
    fail("Bu varyasyon artık satışta değil.");
  return {
    key,
    price: row?.price ?? product.price,
    stock: Math.min(product.stock, row?.stock ?? product.stock),
    selections: (product.variations || []).map((group, i) => ({
      name: group.name,
      value: values[i],
    })),
  };
}
export function resolveOptions(product, item, ownsUpload = () => true) {
  const variant = selectedVariant(product, item.selections);
  const answers = fieldsFor(product).map((field) => {
    // Previously saved carts used note and uploadId; preserve those values.
    let value =
      item.answers?.[field.id] ??
      (field.id === "note"
        ? item.note
        : field.id === "photo" && item.uploadId
          ? [{ id: item.uploadId, name: "Fotoğraf" }]
          : undefined);
    if (field.type === "file") {
      value ??= [];
      if (!Array.isArray(value) || value.length > field.maxFiles)
        fail(`${field.name}: en fazla ${field.maxFiles} fotoğraf seç.`);
      value = value.map((file) => {
        if (!file || typeof file.id !== "string" || !ownsUpload(file.id))
          fail("Fotoğraf bu oturuma ait değil.");
        return { id: file.id, name: text(file.name || "Fotoğraf", 150) };
      });
    } else {
      value = text(value ?? "", field.type === "text" ? field.maxLength : 80);
      if (field.type === "select" && value && !field.options.includes(value))
        fail(`${field.name}: geçerli bir seçenek seç.`);
    }
    if (field.required && !value.length) fail(`${field.name} alanını tamamla.`);
    return { id: field.id, name: field.name, type: field.type, value };
  });
  return { ...variant, answers };
}
