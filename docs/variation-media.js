const colors = {
  mavi: "#2563eb",
  blue: "#2563eb",
  yeşil: "#228b4e",
  yesil: "#228b4e",
  green: "#228b4e",
  siyah: "#171717",
  black: "#171717",
  beyaz: "#ffffff",
  white: "#ffffff",
  kırmızı: "#dc2626",
  kirmizi: "#dc2626",
  red: "#dc2626",
  sarı: "#facc15",
  sari: "#facc15",
  yellow: "#facc15",
  turuncu: "#f97316",
  orange: "#f97316",
  mor: "#9333ea",
  purple: "#9333ea",
  pembe: "#ec4899",
  pink: "#ec4899",
  gri: "#9ca3af",
  gray: "#9ca3af",
  grey: "#9ca3af",
  krem: "#eee5ce",
  cream: "#eee5ce",
  bej: "#d6c4a3",
  beige: "#d6c4a3",
  bordo: "#800020",
  burgundy: "#800020",
  maroon: "#800020",
  lacivert: "#172554",
  navy: "#172554",
  kahverengi: "#795548",
  brown: "#795548",
  doğal: "#e5dac2",
  natural: "#e5dac2",
  "athletic heather": "#b6b6b6",
  "dark grey heather": "#55565a",
  ash: "#d9d9d4",
};
export const validHex = (value) =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
export function colorHex(name, manual) {
  const value = String(name).trim();
  return validHex(manual)
    ? manual.toLowerCase()
    : colors[value.toLocaleLowerCase("tr")] ||
        colors[
          value
            .toLowerCase()
            .normalize("NFD")
            .replace(/\u0307/g, "")
        ] ||
        "#939b9c";
}
export function reorderOptions(options, from, to) {
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= options.length ||
    to >= options.length
  )
    throw new Error("Geçerli bir seçenek sırası seç.");
  const result = [...options],
    item = result.splice(from, 1)[0];
  result.splice(to, 0, item);
  return result;
}
export function variantPhotos(product, selections = {}, preferredId) {
  const bank = product.images?.length
    ? product.images
    : [product.image].filter(Boolean);
  const onlyExisting = (list) =>
    Array.isArray(list)
      ? [...new Set(list.filter((image) => bank.includes(image)))]
      : [];
  const key = JSON.stringify(
    (product.variations || []).map((group) => selections[group.id]),
  );
  const override = onlyExisting(product.variantOverrides?.[key]?.photos);
  if (override.length) return override;
  const groups = [...(product.variations || [])].sort(
    (a, b) =>
      (a.id === preferredId ? -3 : a.kind === "color" ? -1 : 0) -
      (b.id === preferredId ? -3 : b.kind === "color" ? -1 : 0),
  );
  for (const group of groups) {
    const photos = onlyExisting(
      group.linkPhotos ? group.photos?.[selections[group.id]] : [],
    );
    if (photos.length) return photos;
  }
  return bank;
}
