export const defaultCategories = [
  { id: "pet", name: "Minik dostlar" },
  { id: "memories", name: "Özel anılar" },
  { id: "accessories", name: "Aksesuarlar" },
];
export const defaultCollections = [
  { id: "personal", name: "Kişiye özel" },
  { id: "gifts", name: "Hediye fikirleri" },
];

export function taxonomyName(value, records, id) {
  const name = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!name || name.length > 80)
    throw new Error("1–80 karakter uzunluğunda bir ad yaz.");
  if (
    records.some(
      (record) =>
        record.id !== id &&
        record.name.toLocaleLowerCase("tr") === name.toLocaleLowerCase("tr"),
    )
  )
    throw new Error("Bu ad zaten kullanılıyor. Başka bir ad seç.");
  return name;
}

export function productAssignments(product, categories, collections) {
  if (!categories.some((category) => category.id === product.category))
    throw new Error("Ürün için listeden bir kategori seç.");
  const selected = product.collections ?? [];
  if (
    !Array.isArray(selected) ||
    selected.length > 20 ||
    selected.some(
      (id) => !collections.some((collection) => collection.id === id),
    )
  )
    throw new Error("Koleksiyon seçimini kontrol et.");
  return [...new Set(selected)];
}

export function assignmentCount(products, type, id) {
  return products.filter((product) =>
    type === "categories"
      ? product.category === id
      : product.collections?.includes(id),
  ).length;
}

export function assertRemovable(products, type, id) {
  if (assignmentCount(products, type, id))
    throw new Error(
      type === "categories"
        ? "Bu kategoride ürün var. Önce ürünleri başka bir kategoriye taşı."
        : "Bu koleksiyonda ürün var. Önce ürünlerin koleksiyon seçimini değiştir.",
    );
}
