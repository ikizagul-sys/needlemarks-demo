import * as D from "./demo-storage.js?v=9d17c35580d4";
import {
  normalizeOptions,
  resolveOptions,
  selectedVariant,
  reduceVariantStock,
} from "./product-options.js?v=9d17c35580d4";
import { normalizeContent, validateContent } from "./content-defaults.js?v=9d17c35580d4";
import {
  defaultCategories,
  defaultCollections,
  taxonomyName,
  categoryDetails,
  productAssignments,
  assertRemovable,
} from "./catalog-rules.js?v=9d17c35580d4";
export const mode = window.NEEDLEMARKS_CONFIG?.mode || "demo";
if (mode === "demo") await D.initialize();
export const read = D.read;
export const write = D.write;
export const uid = () => crypto.randomUUID();
const seed = await fetch("./data/catalog.json?v=9d17c35580d4").then((r) => r.json());
export let catalog = {
  products: read("products", seed.products),
  settings: read("settings", seed.settings),
  coupons: read("coupons", seed.coupons),
  categories: read("categories", seed.categories || defaultCategories),
  collections: read("collections", seed.collections || defaultCollections),
};
catalog.settings = normalizeContent(catalog.settings);
catalog.products = catalog.products.map((product) => ({
  ...product,
  collections:
    product.collections ??
    seed.products.find((p) => p.id === product.id)?.collections ??
    [],
}));
export let user = mode === "demo" ? read("user", null) : null;
export let cart = read("cart", []);
if (!Array.isArray(cart)) cart = [];
export let favorites = read("favorites", []);
if (!Array.isArray(favorites)) favorites = [];
let orders = read("orders", null);
if (!Array.isArray(orders))
  orders =
    mode === "demo"
      ? seed.products.slice(0, 3).map((p, i) => ({
          id: "sample-order-" + i,
          number: "NM-DEMO-100" + (i + 1),
          userId: "demo-customer",
          customer: {
            name: "Deniz Örnek",
            email: "deniz@example.com",
            phone: "05550000000",
            city: "İstanbul",
            district: "Örnek ilçe",
            address: "Örnek mahalle, örnek sokak 12",
          },
          items: [
            {
              id: p.id,
              name: p.name,
              kind: p.kind,
              image: p.image,
              price: p.price,
              quantity: 1,
              color: p.colors[0],
              size: p.sizes[0],
              note: "Örnek kişiselleştirme",
            },
          ],
          subtotal: p.price,
          discount: 0,
          shipping: 9900,
          total: p.price + 9900,
          status: ["designing", "shipped", "demo-received"][i],
          paymentStatus: "demo-unpaid",
          createdAt: "2026-10-30T08:00:00.000Z",
        }))
      : [];
export const photos = new Map();
export async function request(path, data) {
  const response = await fetch("./api/" + path, {
    method: data === undefined ? "GET" : "POST",
    headers:
      data === undefined
        ? {}
        : { "Content-Type": "application/json", "X-Needlemarks": "1" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Sunucu yanıt vermiyor. Lütfen tekrar dene.");
  }
  if (!response.ok) throw new Error(result.error || "İşlem tamamlanamadı.");
  return result;
}
export async function refresh() {
  if (mode === "server") {
    catalog = { ...(await request("catalog")), coupons: [] };
    catalog.settings = normalizeContent(catalog.settings);
    user = (await request("session")).user;
  }
}
export function saveCart() {
  write("cart", cart);
}
export function removeCart(key) {
  cart = cart.filter((i) => i.key !== key);
  saveCart();
}
export function clearCart() {
  cart = [];
  saveCart();
}
export function toggleFavorite(id) {
  favorites = favorites.includes(id)
    ? favorites.filter((x) => x !== id)
    : [...favorites, id];
  write("favorites", favorites);
}
export function saveDemoCatalog() {
  return D.writeMany({
    products: catalog.products,
    settings: catalog.settings,
    coupons: catalog.coupons,
    categories: catalog.categories,
    collections: catalog.collections,
    orders,
  });
}
export async function login(data, register = false) {
  if (mode === "demo") {
    user = {
      id: "demo-customer",
      name: "Deniz Örnek",
      email: "deniz@example.com",
      role: "customer",
    };
    write("user", user);
    return user;
  }
  user = (await request(register ? "register" : "login", data)).user;
  return user;
}
export async function logout() {
  if (mode === "server") await request("logout", {});
  user = null;
  if (mode === "demo") write("user", null);
}
export function demoAdmin() {
  if (mode !== "demo") return;
  user = {
    id: "demo-admin",
    name: "Demo Yönetici",
    email: "admin@example.com",
    role: "admin",
  };
  write("user", user);
}
export function quoteLocal(code = "") {
  let subtotal = 0;
  for (const item of cart) {
    const product = catalog.products.find(
      (p) => p.id === item.id && p.published,
    );
    if (!product) throw new Error("Sepette satışa kapatılmış bir ürün var.");
    if (item.quantity > product.stock)
      throw new Error(`${product.kind} için yeterli stok yok.`);
    const options = resolveOptions(product, item);
    const total = cart
      .filter(
        (i) =>
          i.id === item.id &&
          selectedVariant(product, i.selections).stockKey === options.stockKey,
      )
      .reduce((sum, i) => sum + i.quantity, 0);
    if (total > options.stock)
      throw new Error("Varyasyon için yeterli stok yok.");
    subtotal += options.price * item.quantity;
  }
  const coupon = code
    ? catalog.coupons.find(
        (c) =>
          c.code === code.toUpperCase() && c.active && c.used < c.usageLimit,
      )
    : null;
  if (code && (!coupon || subtotal < coupon.minimum))
    throw new Error("Kupon geçersiz veya minimum sepet tutarı sağlanmadı.");
  const discount = coupon ? Math.floor((subtotal * coupon.percent) / 100) : 0,
    shipping =
      cart.length &&
      subtotal - discount < catalog.settings.freeShippingThreshold
        ? catalog.settings.shippingFee
        : 0;
  return {
    subtotal,
    discount,
    shipping,
    total: subtotal - discount + shipping,
    coupon: coupon?.code || null,
  };
}
export async function quote(code) {
  return mode === "server"
    ? request("quote", { items: cart, coupon: code })
    : quoteLocal(code);
}
export async function uploadPhoto(file) {
  if (mode === "demo") return "demo-" + uid();
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return (await request("uploads", { base64 })).id;
}
export async function uploadProductPhoto(file) {
  D.validatePhoto(file);
  if (mode === "demo") return D.putImage(file);
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return (await request("admin/images", { base64: data.split(",")[1] })).image;
}
export async function placeOrder(data) {
  if (mode === "server") {
    const result = await request("orders", { ...data, items: cart });
    clearCart();
    await refresh();
    return result;
  }
  const amounts = quoteLocal(data.coupon);
  const demand = new Map();
  for (const item of cart)
    demand.set(item.id, (demand.get(item.id) || 0) + item.quantity);
  for (const [id, count] of demand) {
    if (count > catalog.products.find((p) => p.id === id).stock)
      throw new Error("Toplam adet stok miktarını aşıyor.");
  }
  const existing = orders.find((o) => o.id === data.idempotencyKey);
  if (existing) return existing;
  const order = {
    id: data.idempotencyKey,
    number: "NM-DEMO-" + Date.now().toString(36).toUpperCase(),
    userId: user?.id || null,
    customer: data.customer,
    ...amounts,
    items: cart.map((i) => {
      const p = catalog.products.find((p) => p.id === i.id);
      return {
        ...i,
        name: p.name,
        kind: p.kind,
        image: p.image,
        price: resolveOptions(p, i).price,
        variantKey: resolveOptions(p, i).key,
        stockKey: resolveOptions(p, i).stockKey,
        sku: resolveOptions(p, i).sku,
        managedVariations: p.managedVariations,
        optionSelections: resolveOptions(p, i).selections,
        optionAnswers: resolveOptions(p, i).answers,
      };
    }),
    status: "demo-received",
    paymentStatus: "demo-unpaid",
    createdAt: new Date().toISOString(),
  };
  orders.unshift(order);
  write("orders", orders);
  for (const [id, count] of demand)
    catalog.products.find((p) => p.id === id).stock -= count;
  for (const item of order.items)
    reduceVariantStock(
      catalog.products.find((p) => p.id === item.id),
      item,
    );
  if (amounts.coupon)
    catalog.coupons.find((c) => c.code === amounts.coupon).used++;
  await saveDemoCatalog();
  clearCart();
  return order;
}
export async function getOrders() {
  return mode === "server" ? request("orders") : orders;
}
export async function adminData() {
  if (mode === "server") return request("admin/data");
  return {
    ...catalog,
    orders,
    customers: [
      {
        id: "demo-customer",
        name: "Deniz Örnek",
        email: "deniz@example.com",
        createdAt: new Date().toISOString(),
      },
    ],
  };
}
export async function saveProduct(product) {
  Object.assign(product, normalizeOptions(product));
  product.collections = productAssignments(
    product,
    catalog.categories,
    catalog.collections,
  );
  if (mode === "server") {
    await request("admin/products", product);
    await refresh();
    return;
  }
  const next = catalog.products.some((p) => p.id === product.id)
    ? catalog.products.map((p) => (p.id === product.id ? product : p))
    : [...catalog.products, product];
  await write("products", next);
  catalog.products = next;
}
export async function saveSettings(settings) {
  settings = validateContent(
    settings,
    (image) =>
      typeof image === "string" &&
      (/^(assets|media)\//.test(image) ||
        /^data:image\/(png|jpeg|webp);base64,/.test(image) ||
        D.ownsImage(image)),
  );
  if (mode === "server") {
    await request("admin/settings", settings);
    await refresh();
    return;
  }
  catalog.settings = settings;
  await saveDemoCatalog();
}
export async function saveCoupon(coupon) {
  if (mode === "server") return request("admin/coupons", coupon);
  const index = catalog.coupons.findIndex((c) => c.code === coupon.code);
  if (index < 0) catalog.coupons.push({ ...coupon, used: 0 });
  else
    catalog.coupons[index] = { ...coupon, used: catalog.coupons[index].used };
  await saveDemoCatalog();
}
export async function updateOrder(id, status) {
  if (mode === "server") return request("admin/orders", { id, status });
  orders.find((o) => o.id === id).status = status;
  await write("orders", orders);
}
export async function resetDemo() {
  if (mode !== "demo") return;
  await D.clear();
  location.reload();
}

export async function saveTaxonomy(type, record) {
  if (!["categories", "collections"].includes(type))
    throw new Error("Geçersiz bölüm.");
  if (mode === "server") {
    await request("admin/taxonomies", { type, ...record });
    await refresh();
    return;
  }
  const id = record.id || uid(),
    name = taxonomyName(record.name, catalog[type], id);
  const updated =
    type === "categories"
      ? categoryDetails(
          record,
          catalog[type],
          id,
          (image) =>
            D.ownsImage(image) ||
            /^data:image\/(png|jpeg|webp);base64,/.test(image),
        )
      : { id, name };
  const next = catalog[type].some((item) => item.id === id)
    ? catalog[type].map((item) => (item.id === id ? updated : item))
    : [...catalog[type], updated];
  await write(type, next);
  catalog[type] = next;
}
export async function removeTaxonomy(type, id) {
  if (!["categories", "collections"].includes(type))
    throw new Error("Geçersiz bölüm.");
  if (mode === "server") {
    await request("admin/taxonomies/remove", { type, id });
    await refresh();
    return;
  }
  assertRemovable(catalog.products, type, id);
  const next = catalog[type].filter((item) => item.id !== id);
  await write(type, next);
  catalog[type] = next;
}
