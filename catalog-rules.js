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

export function categorySlug(value) {
  return String(value ?? "")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/, "");
}

export function categoryDetails(data, records, id, allowDataImages = false) {
  const previous = records.find((record) => record.id === id);
  const name = taxonomyName(data.name, records, id);
  const slug =
    data.slug === undefined
      ? previous?.slug || categorySlug(name)
      : String(data.slug).trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100)
    throw new Error(
      "Bağlantı adı için küçük harf, rakam ve kısa çizgi kullan.",
    );
  if (
    records.some(
      (record) =>
        record.id !== id && (record.slug || categorySlug(record.name)) === slug,
    )
  )
    throw new Error("Bu bağlantı adı zaten kullanılıyor.");
  const image = data.image ?? previous?.image ?? "";
  if (
    typeof image !== "string" ||
    (image &&
      !/^(assets\/[a-zA-Z0-9._-]+|media\/[a-f0-9-]+)\.(webp|png|jpg)$/.test(
        image,
      ) &&
      !(
        allowDataImages &&
        /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)
      ))
  )
    throw new Error("Geçerli bir kategori fotoğrafı seç.");
  if (data.active !== undefined && typeof data.active !== "boolean")
    throw new Error("Kategori görünürlüğünü kontrol et.");
  return {
    id,
    name,
    slug,
    image,
    active: data.active ?? previous?.active ?? true,
  };
}
