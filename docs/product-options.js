import { colorHex, validHex } from "./variation-media.js?v=196d1669caaa";
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
  const bank = product.images ?? (product.image ? [product.image] : null);
  const photos = (list) => {
    if (list === undefined) return [];
    if (
      !Array.isArray(list) ||
      list.length > 8 ||
      list.some((value) => typeof value !== "string")
    )
      fail("Varyasyon fotoğraflarını kontrol et.");
    return [...new Set(list.filter((value) => !bank || bank.includes(value)))];
  };
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
  if (!Array.isArray(groups) || groups.length > 3)
    fail("En fazla 3 varyasyon grubu eklenebilir.");
  const variations = groups.map((group) => ({
    id: text(group.id, 80),
    name: text(group.name, 80),
    options: choices(group.options),
    allowExtras: group.kind === "placement" && group.allowExtras === true,
    extraOptions: (() => {
      const options = group.extraOptions ?? [];
      if (
        !Array.isArray(options) ||
        options.some((value) => !group.options.includes(value)) ||
        new Set(options).size !== options.length
      )
        fail("Ek nakış konumlarını kontrol et.");
      return options;
    })(),
    extraPrices: Object.fromEntries(
      (group.options || []).map((value) => [
        value,
        number(group.extraPrices?.[value] ?? 0, 0, 100000000),
      ]),
    ),
    linkPhotos: group.linkPhotos === true,
    swatches: Object.fromEntries(
      (group.options || []).map((value) => {
        if (
          group.swatches?.[value] !== undefined &&
          !validHex(group.swatches[value])
        )
          fail("Renk için #RRGGBB biçiminde bir HEX değeri gir.");
        return [value, colorHex(value, group.swatches?.[value])];
      }),
    ),
    photos: Object.fromEntries(
      (group.options || []).map((value) => [
        value,
        photos(group.photos?.[value]),
      ]),
    ),
    kind: ["size", "color", "placement"].includes(group.kind)
      ? group.kind
      : "custom",
    markers: Object.fromEntries(
      (group.options || []).map((value) => [
        value,
        [
          "right-sleeve",
          "left-sleeve",
          "left-chest",
          "center-chest",
          "back",
          "front",
        ].includes(group.markers?.[value])
          ? group.markers[value]
          : "front",
      ]),
    ),
  }));
  for (const row of variations)
    if (!/^[\w-]+$/.test(row.id) || !row.name) fail("Varyasyon adını doldur.");
  unique(variations, "id");
  unique(variations, "name");
  if (
    variations.reduce((count, group) => count * group.options.length, 1) > 400
  )
    fail("En fazla 400 varyasyon birleşimi oluşturulabilir.");
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
  const variationRules = normalizeRules(product.variationRules, variations);
  const variantOverrides = {};
  if (
    product.variantOverrides !== undefined &&
    (typeof product.variantOverrides !== "object" ||
      product.variantOverrides === null ||
      Array.isArray(product.variantOverrides))
  )
    fail("Varyasyon satırlarını kontrol et.");
  for (const [key, row] of Object.entries(product.variantOverrides || {})) {
    if (!keys.includes(key) || !row || typeof row !== "object")
      fail("Geçersiz varyasyon satırı.");
    variantOverrides[key] = {
      visible: row.visible !== false,
      photos: photos(row.photos),
    };
  }
  if (
    keys.length &&
    keys.every((key) => variantOverrides[key]?.visible === false)
  )
    fail("En az bir varyasyon görünür olmalı.");
  return {
    variations,
    variants,
    customFields,
    variationRules,
    variantOverrides,
    processingProfile: text(product.processingProfile ?? "", 120),
    managedVariations: product.managedVariations === true,
    sku: text(product.sku ?? "", 80),
  };
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
  if (product.variantOverrides?.[key]?.visible === false)
    fail("Bu varyasyon şu anda görünür değil. Başka bir seçenek seç.");
  const row = product.variants?.find((row) => row.key === key);
  if (product.variants?.length && !row)
    fail("Bu varyasyon artık satışta değil.");
  const attribute = (type, fallback) => {
    const rule = product.variationRules?.[type];
    if (!rule?.enabled) return { value: fallback, key };
    const selectedValues =
      rule.scope === "*" ? values : [selected?.[rule.scope]];
    const ruleKey = variantKey(selectedValues),
      entry = rule.values.find((entry) => entry.key === ruleKey);
    if (!entry) fail("Ürün seçenekleri değişmiş. Ürünü yeniden seç.");
    return { value: entry.value, key: ruleKey };
  };
  const price = attribute("price", row?.price ?? product.price),
    stock = attribute("stock", row?.stock ?? product.stock),
    sku = attribute("sku", product.sku || ""),
    processing = attribute("processing", product.processingProfile || "");
  const extras = selected?.$extras ?? {};
  if (!extras || typeof extras !== "object" || Array.isArray(extras))
    fail("Ek nakış seçimlerini kontrol et.");
  let extrasPrice = 0;
  const extraSelections = [];
  for (const [id, choices] of Object.entries(extras)) {
    const group = (product.variations || []).find((group) => group.id === id);
    if (
      !group?.allowExtras ||
      group.kind !== "placement" ||
      !Array.isArray(choices) ||
      new Set(choices).size !== choices.length ||
      choices.some(
        (value) =>
          !group.extraOptions?.includes(value) || value === selected[id],
      )
    )
      fail("Geçersiz veya tekrarlanan ek nakış konumu.");
    for (const value of group.extraOptions.filter((value) =>
      choices.includes(value),
    )) {
      const fee = group.extraPrices?.[value] ?? 0;
      extrasPrice += fee;
      extraSelections.push({
        name: "Ek nakış · " + group.name,
        value:
          value +
          " (+" +
          new Intl.NumberFormat("tr-TR", {
            style: "currency",
            currency: "TRY",
          }).format(fee / 100) +
          ")",
      });
    }
  }
  return {
    key,
    price: price.value + extrasPrice,
    basePrice: price.value,
    extrasPrice,
    stock: Math.min(product.stock, stock.value),
    stockKey: stock.key,
    sku: sku.value,
    processingProfile: processing.value,
    selections: [
      ...(product.variations || []).map((group, i) => ({
        name: group.name,
        value: values[i],
      })),
      ...extraSelections,
    ],
  };
}
export function scopeCombinations(groups, scope) {
  return combinations(
    scope === "*" ? groups : groups.filter((group) => group.id === scope),
  );
}
export function normalizeRules(input, groups) {
  if (input === undefined) return undefined;
  const result = {};
  for (const type of ["price", "stock", "sku", "processing"]) {
    const rule = input?.[type];
    if (!rule?.enabled || !groups.length) {
      result[type] = { enabled: false, scope: "*", values: [] };
      continue;
    }
    if (rule.scope !== "*" && !groups.some((group) => group.id === rule.scope))
      fail("Fiyat, stok veya ürün kodu için geçerli bir grup seç.");
    const keys = scopeCombinations(groups, rule.scope).map(variantKey);
    if (
      !Array.isArray(rule.values) ||
      rule.values.length !== keys.length ||
      new Set(rule.values.map((entry) => entry.key)).size !== keys.length
    )
      fail("Varyasyon tablosunu yeniden oluştur.");
    result[type] = {
      enabled: true,
      scope: rule.scope,
      values: rule.values.map((entry) => {
        if (!keys.includes(entry.key))
          fail("Varyasyon tablosunu yeniden oluştur.");
        return {
          key: entry.key,
          value:
            type === "sku" || type === "processing"
              ? text(entry.value, type === "processing" ? 120 : 80)
              : number(
                  entry.value,
                  type === "price" ? 1 : 0,
                  type === "price" ? 100000000 : 100000,
                ),
        };
      }),
    };
  }
  return result;
}
export function matchingVariants(product, selected = {}) {
  const groups = product.variations || [];
  return combinations(groups)
    .filter((values) =>
      groups.every(
        (group, index) =>
          !selected[group.id] || selected[group.id] === values[index],
      ),
    )
    .flatMap((values) => {
      try {
        return [
          selectedVariant(
            product,
            Object.fromEntries(
              groups.map((group, index) => [group.id, values[index]]),
            ),
          ),
        ];
      } catch {
        return [];
      }
    });
}
export function reduceVariantStock(product, item) {
  const rule = product.variationRules?.stock;
  if (rule?.enabled) {
    const entry = rule.values.find((entry) => entry.key === item.stockKey);
    if (!entry || entry.value < item.quantity)
      fail("Varyasyon için yeterli stok yok.");
    entry.value -= item.quantity;
  } else {
    const variant = product.variants?.find(
      (row) => row.key === item.variantKey,
    );
    if (variant) variant.stock -= item.quantity;
  }
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
