import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, basename, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createStore } from "../server/store.mjs";
import { validatePhoto, moveToCover } from "../demo-storage.js";
import { colorHex, reorderOptions, variantPhotos } from "../variation-media.js";
import {
  normalizeOptions,
  resolveOptions,
  variantKey,
  matchingVariants,
} from "../product-options.js";
const seed = JSON.parse(
  readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8"),
);
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "needlemarks-test-"));
  const store = createStore({
    directory,
    seed,
    adminEmail: "admin@example.com",
    adminPassword: "Test-only-admin-8492",
  });
  t.after(() => {
    store.close();
    const path = resolve(directory);
    assert.ok(
      path.startsWith(resolve(tmpdir()) + sep) &&
        basename(path).startsWith("needlemarks-test-"),
    );
    rmSync(path, { recursive: true, force: true });
  });
  return store;
}
const item = {
  id: "lucky",
  quantity: 1,
  color: "Krem",
  size: "M",
  note: "Milo",
};
const customer = {
  name: "Deniz Örnek",
  email: "deniz@example.com",
  phone: "05550000000",
  city: "İstanbul",
  district: "Kadıköy",
  address: "Örnek mahalle, örnek sokak 12",
};
const order = (key = randomUUID()) => ({
  idempotencyKey: key,
  items: [{ ...item, price: 1 }],
  coupon: "ILKILMEK10",
  customer,
  consent: true,
});
function extraEmbroideryProduct(s) {
  return s.saveProduct(
    {
      ...s.products(true).find((p) => p.id === "lucky"),
      price: 90000,
      managedVariations: true,
      variations: [
        {
          id: "location",
          name: "Nakış konumu",
          kind: "placement",
          options: ["Göğüs", "Sol kol", "Sağ kol"],
          allowExtras: true,
          extraOptions: ["Sol kol", "Sağ kol"],
          extraPrices: { "Sol kol": 25000, "Sağ kol": 15000 },
        },
      ],
      variants: [],
      variationRules: undefined,
      variantOverrides: {},
    },
    "admin",
  );
}
test("ana nakışa birden fazla ek konum ücreti eklenir; tek ürün stoku düşer", (t) => {
  const s = fixture(t);
  extraEmbroideryProduct(s);
  const selected = (extras) => ({
    ...item,
    selections: { location: "Göğüs", $extras: { location: extras } },
    price: 1,
  });
  assert.equal(s.calculate({ items: [selected([])] }, "owner").subtotal, 90000);
  assert.equal(
    s.calculate({ items: [selected(["Sol kol"])] }, "owner").subtotal,
    115000,
  );
  assert.equal(
    s.calculate({ items: [selected(["Sol kol", "Sağ kol"])] }, "owner")
      .subtotal,
    130000,
  );
  const saved = s.createOrder(
    { ...order(), coupon: "", items: [selected(["Sol kol"])] },
    "owner",
    null,
  );
  assert.equal(saved.items[0].price, 115000);
  assert.ok(
    saved.items[0].optionSelections.some(
      (row) => row.value.includes("Sol kol") && row.value.includes("250"),
    ),
  );
  assert.equal(s.products(true).find((p) => p.id === "lucky").stock, 23);
});
test("ek nakış tekrar, ana konum, geçersiz konum ve kapalı özellik üzerinden eklenemez", (t) => {
  const s = fixture(t),
    p = extraEmbroideryProduct(s);
  for (const extras of [["Sol kol", "Sol kol"], ["Göğüs"], ["Sırt"]])
    assert.throws(
      () =>
        s.calculate(
          {
            items: [
              {
                ...item,
                selections: {
                  location: "Göğüs",
                  $extras: { location: extras },
                },
              },
            ],
          },
          "owner",
        ),
      /ek nakış/,
    );
  assert.throws(
    () =>
      normalizeOptions({
        ...p,
        variations: p.variations.map((group) => ({
          ...group,
          extraPrices: { "Sol kol": -1 },
        })),
      }),
    /fiyatını/,
  );
  s.saveProduct(
    {
      ...p,
      variations: p.variations.map((group) => ({
        ...group,
        allowExtras: false,
      })),
    },
    "admin",
  );
  assert.throws(
    () =>
      s.calculate(
        {
          items: [
            {
              ...item,
              selections: {
                location: "Göğüs",
                $extras: { location: ["Sol kol"] },
              },
            },
          ],
        },
        "owner",
      ),
    /ek nakış/,
  );
});
test("Türkçe/İngilizce renkler, manuel HEX ve erişilebilir sıralama", () => {
  assert.equal(colorHex("Mavi"), colorHex("BLUE"));
  assert.equal(colorHex("Beyaz"), "#ffffff");
  assert.equal(colorHex("WHITE"), "#ffffff");
  assert.equal(colorHex("Yeşil", "#123ABC"), "#123abc");
  assert.deepEqual(reorderOptions(["Mavi", "Yeşil", "Kırmızı"], 0, 2), [
    "Yeşil",
    "Kırmızı",
    "Mavi",
  ]);
});
function mediaProduct(s) {
  const p = s.products(true).find((p) => p.id === "lucky");
  return s.saveProduct(
    {
      ...p,
      managedVariations: true,
      images: [
        "assets/hero.webp",
        "assets/sweatshirt.webp",
        "assets/tote.webp",
      ],
      variations: [
        {
          id: "color",
          name: "Renkler",
          kind: "color",
          options: ["Yeşil", "Mavi", "Kırmızı"],
          swatches: { Mavi: "#0033ff" },
          linkPhotos: true,
          photos: {
            Mavi: ["assets/hero.webp", "assets/tote.webp"],
            Yeşil: ["assets/sweatshirt.webp"],
          },
        },
      ],
      variants: [],
      customFields: p.customFields,
      variationRules: {
        price: {
          enabled: true,
          scope: "color",
          values: ["Yeşil", "Mavi", "Kırmızı"].map((value) => ({
            key: variantKey([value]),
            value: value === "Mavi" ? 199000 : 189000,
          })),
        },
        processing: {
          enabled: true,
          scope: "color",
          values: ["Yeşil", "Mavi", "Kırmızı"].map((value) => ({
            key: variantKey([value]),
            value: value === "Mavi" ? "3–5 iş günü" : "1–2 iş günü",
          })),
        },
      },
      variantOverrides: {
        [variantKey(["Kırmızı"])]: { visible: false, photos: [] },
      },
    },
    "admin",
  );
}
test("renk sırası, çoklu fotoğraf bağı ve hazırlık profili SQLite kaydında korunur", (t) => {
  const s = fixture(t);
  mediaProduct(s);
  const p = s.products(true).find((p) => p.id === "lucky");
  assert.deepEqual(p.variations[0].options, ["Yeşil", "Mavi", "Kırmızı"]);
  assert.equal(p.variations[0].swatches.Mavi, "#0033ff");
  assert.deepEqual(variantPhotos(p, { color: "Mavi" }), [
    "assets/hero.webp",
    "assets/tote.webp",
  ]);
  assert.deepEqual(variantPhotos(p, { color: "Yeşil" }), [
    "assets/sweatshirt.webp",
  ]);
  const saved = s.createOrder(
    {
      ...order(),
      coupon: "",
      items: [{ ...item, selections: { color: "Mavi" } }],
    },
    "owner",
    null,
  );
  assert.equal(saved.items[0].price, 199000);
  assert.equal(saved.items[0].processingProfile, "3–5 iş günü");
  assert.equal(saved.items[0].optionSelections[0].value, "Mavi");
  const green = s.createOrder(
    {
      ...order(),
      coupon: "",
      items: [{ ...item, selections: { color: "Yeşil" } }],
    },
    "owner",
    null,
  );
  assert.equal(green.items[0].image, "assets/sweatshirt.webp");
});
test("gizli birleşim sunucuda satın alınamaz, tükenmiş stok atlanamaz", (t) => {
  const s = fixture(t),
    p = mediaProduct(s);
  assert.throws(
    () =>
      s.calculate(
        { items: [{ ...item, selections: { color: "Kırmızı" } }] },
        "owner",
      ),
    /görünür/,
  );
  assert.equal(matchingVariants(p, { color: "Kırmızı" }).length, 0);
  const changed = s.saveProduct(
    {
      ...p,
      variationRules: {
        ...p.variationRules,
        stock: {
          enabled: true,
          scope: "color",
          values: p.variations[0].options.map((value) => ({
            key: variantKey([value]),
            value: value === "Mavi" ? 0 : 2,
          })),
        },
      },
    },
    "admin",
  );
  assert.equal(matchingVariants(changed, { color: "Mavi" })[0].stock, 0);
  assert.throws(
    () =>
      s.calculate(
        { items: [{ ...item, selections: { color: "Mavi" } }] },
        "owner",
      ),
    /stok/,
  );
});
test("birleşim fotoğrafı önceliklidir; silinen/bağlanmayan fotoğraf varsayılan galeriye döner", (t) => {
  const s = fixture(t),
    p = mediaProduct(s),
    key = variantKey(["Mavi"]);
  const mapped = s.saveProduct(
    {
      ...p,
      variantOverrides: {
        ...p.variantOverrides,
        [key]: { visible: true, photos: ["assets/sweatshirt.webp"] },
      },
    },
    "admin",
  );
  assert.deepEqual(variantPhotos(mapped, { color: "Mavi" }), [
    "assets/sweatshirt.webp",
  ]);
  const removed = s.saveProduct(
    {
      ...mapped,
      images: ["assets/hero.webp"],
      variations: mapped.variations.map((group) => ({
        ...group,
        linkPhotos: false,
      })),
    },
    "admin",
  );
  assert.deepEqual(variantPhotos(removed, { color: "Mavi" }), [
    "assets/hero.webp",
  ]);
  assert.throws(
    () =>
      normalizeOptions({
        ...p,
        variations: p.variations.map((group) => ({
          ...group,
          swatches: { Mavi: "invalid" },
        })),
      }),
    /HEX/,
  );
  assert.throws(
    () =>
      normalizeOptions({
        ...p,
        variantOverrides: Object.fromEntries(
          p.variations[0].options.map((value) => [
            variantKey([value]),
            { visible: false },
          ]),
        ),
      }),
    /görünür/,
  );
});
test("fotoğraf sınırı her dosya için 5 MB: 1.5 MB ve 5 MB kabul, üstü reddedilir", () => {
  for (const size of [1.5 * 1024 * 1024, 4.9 * 1024 * 1024, 5 * 1024 * 1024])
    assert.doesNotThrow(() => validatePhoto({ size, type: "image/webp" }));
  assert.throws(
    () => validatePhoto({ size: 5 * 1024 * 1024 + 1, type: "image/webp" }),
    /5 MB/,
  );
  assert.throws(() => validatePhoto({ size: 100, type: "text/html" }), /5 MB/);
});
test("vitrin seçimi diğer fotoğrafları korur ve galeri sırasını değiştirmez", () => {
  const images = ["bir", "iki", "uc"];
  assert.deepEqual(moveToCover(images, 2), ["uc", "bir", "iki"]);
  assert.deepEqual(images, ["bir", "iki", "uc"]);
  assert.throws(() => moveToCover(images, 9), /geçerli/);
});
test("temiz tarayıcıda demo açılır ve kişiselleştirme siparişi oluşturulur", () => {
  const script = `
    import assert from 'node:assert/strict';
    import {readFileSync} from 'node:fs';
    const seed=JSON.parse(readFileSync('./data/catalog.json','utf8'));
    globalThis.window={NEEDLEMARKS_CONFIG:{mode:'demo'}};
    const saved=new Map();
    globalThis.localStorage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)};
    globalThis.fetch=async()=>({json:async()=>structuredClone(seed)});
    const S=await import('./data.js');
    assert.equal((await S.getOrders()).length,3);
    const p=S.catalog.products.find(p=>p.id==='together');
    S.cart.push({id:p.id,key:'sample',quantity:1,color:p.colors[0],size:p.sizes[0],selections:{size:'M',color:p.colors[0],placement:'Sağ kol'},answers:{'right-name':'Milo','left-name':'Luna',thread:'Bordo',photos:[]}});
    assert.equal(S.quoteLocal().subtotal,p.price);
    const order=await S.placeOrder({idempotencyKey:'fresh-browser-test',customer:{name:'Deniz Örnek'}});
    assert.equal(order.items[0].optionSelections.find(row=>row.name==='Nakış konumu').value,'Sağ kol');
    assert.equal(order.items[0].optionAnswers[0].value,'Milo');
    assert.equal(S.cart.length,0);
  `;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", script],
    { cwd: new URL("..", import.meta.url), encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
});
function customized(s) {
  const p = s.products(true).find((p) => p.id === "lucky");
  return s.saveProduct(
    {
      ...p,
      variations: [
        {
          id: "placement",
          name: "Nakış yeri",
          options: ["Sağ kol", "Sol kol"],
        },
      ],
      variants: [
        { key: variantKey(["Sağ kol"]), price: 190000, stock: 2 },
        { key: variantKey(["Sol kol"]), price: 210000, stock: 1 },
      ],
      customFields: [
        {
          id: "name",
          name: "Sağ kola yazılacak isim",
          type: "text",
          required: true,
          maxLength: 12,
        },
        {
          id: "thread",
          name: "İplik rengi",
          type: "select",
          required: true,
          options: ["Siyah", "Beyaz"],
        },
        {
          id: "photos",
          name: "Referans fotoğrafları",
          type: "file",
          required: false,
          maxFiles: 2,
        },
      ],
    },
    "admin",
  );
}
const customizedItem = () => ({
  ...item,
  selections: { placement: "Sağ kol" },
  answers: { name: "Milo", thread: "Siyah", photos: [] },
});
function scopedProduct(s) {
  const p = s.products(true).find((p) => p.id === "lucky");
  return s.saveProduct(
    {
      ...p,
      managedVariations: true,
      sku: "COMMON",
      customFields: [],
      variations: [
        { id: "size", name: "Beden", kind: "size", options: ["S", "M"] },
        {
          id: "color",
          name: "Renk",
          kind: "color",
          options: ["Siyah", "Krem"],
        },
        {
          id: "location",
          name: "Nakış konumu",
          kind: "placement",
          options: ["Sağ kol", "Sol göğüs"],
          markers: { "Sağ kol": "right-sleeve", "Sol göğüs": "left-chest" },
        },
      ],
      variants: [],
      variationRules: {
        price: {
          enabled: true,
          scope: "location",
          values: [
            { key: variantKey(["Sağ kol"]), value: 190000 },
            { key: variantKey(["Sol göğüs"]), value: 210000 },
          ],
        },
        stock: {
          enabled: true,
          scope: "size",
          values: [
            { key: variantKey(["S"]), value: 5 },
            { key: variantKey(["M"]), value: 2 },
          ],
        },
        sku: {
          enabled: true,
          scope: "color",
          values: [
            { key: variantKey(["Siyah"]), value: "NM-SY" },
            { key: variantKey(["Krem"]), value: "NM-KR" },
          ],
        },
      },
    },
    "admin",
  );
}
const scopedItem = (color = "Siyah", location = "Sağ kol") => ({
  ...item,
  selections: { size: "M", color, location },
  answers: {},
});
test("fiyat, stok ve SKU bağımsız gruplara göre hesaplanır ve siparişe kaydedilir", (t) => {
  const s = fixture(t),
    p = scopedProduct(s);
  assert.equal(p.variations[2].markers["Sol göğüs"], "left-chest");
  const calculated = s.calculate(
    { items: [{ ...scopedItem("Krem", "Sol göğüs"), price: 1, sku: "FAKE" }] },
    "owner",
  );
  assert.equal(calculated.items[0].price, 210000);
  assert.equal(calculated.items[0].sku, "NM-KR");
  assert.equal(calculated.items[0].stockKey, variantKey(["M"]));
  const data = {
    ...order(),
    coupon: "",
    items: [scopedItem("Krem", "Sol göğüs")],
  };
  const saved = s.createOrder(data, "owner", null);
  assert.equal(saved.items[0].sku, "NM-KR");
  assert.equal(
    s.products(true).find((p) => p.id === "lucky").variationRules.stock
      .values[1].value,
    1,
  );
  s.createOrder(data, "owner", null);
  assert.equal(
    s.products(true).find((p) => p.id === "lucky").variationRules.stock
      .values[1].value,
    1,
  );
});
test("aynı bedenin stoku renk veya konum değiştirerek aşılamaz", (t) => {
  const s = fixture(t);
  scopedProduct(s);
  assert.throws(
    () =>
      s.calculate(
        {
          items: [
            scopedItem("Siyah"),
            { ...scopedItem("Krem", "Sol göğüs"), quantity: 2 },
          ],
        },
        "owner",
      ),
    /stok/,
  );
  s.createOrder(
    {
      ...order(),
      coupon: "",
      items: [scopedItem("Siyah"), scopedItem("Krem", "Sol göğüs")],
    },
    "owner",
    null,
  );
  assert.throws(
    () =>
      s.createOrder(
        { ...order(), coupon: "", items: [scopedItem()] },
        "owner",
        null,
      ),
    /stok/,
  );
  const p = s.products(true).find((p) => p.id === "lucky");
  assert.equal(p.variationRules.stock.values[1].value, 0);
  assert.equal(p.stock, 22);
});
test("bağımsız anahtarlar kapatılınca ortak değerler kullanılır; varyasyonsuz ürün seçimsiz alınır", (t) => {
  const s = fixture(t),
    p = scopedProduct(s);
  const disabled = Object.fromEntries(
    ["price", "stock", "sku"].map((type) => [
      type,
      { enabled: false, scope: "*", values: [] },
    ]),
  );
  const shared = s.saveProduct({ ...p, variationRules: disabled }, "admin");
  const selected = resolveOptions(shared, scopedItem());
  assert.equal(selected.price, p.price);
  assert.equal(selected.stock, p.stock);
  assert.equal(selected.sku, "COMMON");
  const simple = s.saveProduct(
    { ...shared, variations: [], variationRules: disabled, customFields: [] },
    "admin",
  );
  assert.equal(
    s.calculate({ items: [{ id: simple.id, quantity: 1 }] }, "owner").subtotal,
    simple.price,
  );
  assert.throws(
    () =>
      normalizeOptions({
        ...p,
        variationRules: {
          ...p.variationRules,
          price: { ...p.variationRules.price, scope: "missing" },
        },
      }),
    /geçerli bir grup/,
  );
});
test("özel başlıklar ve alanlar kaydedilir; geçersiz tanım reddedilir", (t) => {
  const s = fixture(t),
    p = customized(s);
  assert.equal(
    s.products(true).find((p) => p.id === "lucky").variations[0].name,
    "Nakış yeri",
  );
  assert.equal(p.customFields[0].name, "Sağ kola yazılacak isim");
  assert.throws(
    () =>
      normalizeOptions({
        ...p,
        variations: [{ id: "a", name: "Konum", options: ["Kol", "kol"] }],
      }),
    /tekrarlanan/,
  );
  assert.throws(
    () =>
      normalizeOptions({
        ...p,
        customFields: Array(6).fill(p.customFields[0]),
      }),
    /5/,
  );
  assert.throws(
    () => normalizeOptions({ ...p, variants: p.variants.slice(1) }),
    /tablosunu/,
  );
});
test("zorunlu alan, karakter sınırı ve izin verilmeyen seçimler sunucuda reddedilir", (t) => {
  const s = fixture(t);
  customized(s);
  const quote = (i) => s.calculate({ items: [i] }, "owner");
  assert.throws(
    () => quote({ ...customizedItem(), selections: { placement: "Göğüs" } }),
    /Nakış yeri/,
  );
  assert.throws(
    () =>
      quote({ ...customizedItem(), answers: { name: "", thread: "Siyah" } }),
    /tamamla/,
  );
  assert.throws(
    () =>
      quote({
        ...customizedItem(),
        answers: { name: "Bu metin çok uzun", thread: "Siyah" },
      }),
    /metnini/,
  );
  assert.throws(
    () =>
      quote({
        ...customizedItem(),
        answers: { name: "Milo", thread: "Kırmızı" },
      }),
    /geçerli/,
  );
});
test("birleşim fiyatı sunucudan gelir; toplam birleşim stoku ve sipariş anlık görüntüsü korunur", (t) => {
  const s = fixture(t);
  customized(s);
  const data = {
    ...order(),
    coupon: "",
    items: [{ ...customizedItem(), price: 1 }],
  };
  assert.equal(s.calculate(data, "owner").subtotal, 190000);
  assert.throws(
    () =>
      s.calculate(
        {
          ...data,
          items: [{ ...customizedItem(), quantity: 2 }, customizedItem()],
        },
        "owner",
      ),
    /stok/,
  );
  const saved = s.createOrder(data, "owner", null);
  assert.equal(saved.items[0].optionSelections[0].value, "Sağ kol");
  assert.equal(saved.items[0].optionAnswers[0].value, "Milo");
  assert.equal(
    s.products(true).find((p) => p.id === "lucky").variants[0].stock,
    1,
  );
  s.createOrder(data, "owner", null);
  assert.equal(
    s.products(true).find((p) => p.id === "lucky").variants[0].stock,
    1,
  );
  const product = s.products(true).find((p) => p.id === "lucky");
  s.saveProduct({ ...product, customFields: [] }, "admin");
  assert.equal(saved.items[0].optionAnswers[0].name, "Sağ kola yazılacak isim");
});
test("çoklu fotoğrafta dosya sınırı ve her dosyanın sahipliği doğrulanır", (t) => {
  const s = fixture(t),
    p = customized(s),
    base = customizedItem();
  assert.throws(
    () =>
      resolveOptions(
        p,
        {
          ...base,
          answers: { ...base.answers, photos: [{ id: "a", name: "a.jpg" }] },
        },
        () => false,
      ),
    /oturuma/,
  );
  assert.throws(
    () =>
      resolveOptions(p, {
        ...base,
        answers: {
          ...base.answers,
          photos: Array(3).fill({ id: "a", name: "a.jpg" }),
        },
      }),
    /en fazla 2/,
  );
  const result = resolveOptions(
    p,
    {
      ...base,
      answers: {
        ...base.answers,
        photos: [
          { id: "a", name: "a.jpg" },
          { id: "b", name: "b.jpg" },
        ],
      },
    },
    () => true,
  );
  assert.equal(result.answers[2].value.length, 2);
});
test("hesap parolası özetlenir, rol istemciden yükseltilemez, çıkış oturumu iptal eder", (t) => {
  const s = fixture(t);
  const result = s.register({
    name: "Deniz Örnek",
    email: "user@example.com",
    password: "Sample-customer-8492",
    role: "admin",
  });
  assert.equal(result.user.role, "customer");
  assert.equal(s.session(result.token).email, "user@example.com");
  const row = s.db
    .prepare("SELECT password FROM users WHERE email=?")
    .get("user@example.com");
  assert.notEqual(row.password, "Sample-customer-8492");
  s.logout(result.token);
  assert.equal(s.session(result.token), null);
  assert.throws(
    () => s.authenticate("user@example.com", "wrong", "test-ip"),
    /hatalı/,
  );
});
test("tekrarlanan başarısız girişler sınırlandırılır", (t) => {
  const s = fixture(t);
  for (let i = 0; i < 8; i++)
    assert.throws(() =>
      s.authenticate("admin@example.com", "wrong", "test-ip"),
    );
  assert.throws(
    () =>
      s.authenticate("admin@example.com", "Test-only-admin-8492", "test-ip"),
    /Çok fazla/,
  );
});
test("fiyat istemciden alınmaz, kupon ve kargo kuruşla hesaplanır", (t) => {
  const s = fixture(t),
    q = s.calculate(order(), "guest-a");
  assert.equal(q.subtotal, 189000);
  assert.equal(q.discount, 18900);
  assert.equal(q.shipping, 9900);
  assert.equal(q.total, 180000);
  assert.throws(
    () => s.calculate({ ...order(), coupon: "BAD" }, "guest-a"),
    /Kupon/,
  );
  assert.throws(
    () =>
      s.calculate(
        { ...order(), items: [{ ...item, color: "invalid" }] },
        "guest-a",
      ),
    /Renk/,
  );
});
test("aynı ürüne ait satırlar birlikte stok sınırına tabidir", (t) => {
  const s = fixture(t);
  assert.throws(
    () =>
      s.calculate(
        {
          items: [
            { ...item, quantity: 20 },
            { ...item, quantity: 20 },
          ],
        },
        "guest-a",
      ),
    /yeterli stok/,
  );
  assert.throws(
    () => s.calculate({ items: [{ ...item, quantity: -1 }] }, "guest-a"),
    /Geçersiz sayı/,
  );
});
test("sipariş atomik, idempotent ve başka oturuma kapalıdır", (t) => {
  const s = fixture(t),
    payload = order();
  const first = s.createOrder(payload, null, "guest-a");
  const again = s.createOrder(payload, null, "guest-a");
  assert.equal(first.id, again.id);
  assert.equal(s.products().find((p) => p.id === "lucky").stock, 23);
  assert.equal(s.coupons()[0].used, 1);
  assert.equal(s.orders(null, "guest-b").length, 0);
  assert.equal(s.orders(null, "guest-a").length, 1);
  assert.throws(
    () => s.createOrder(payload, null, "guest-b"),
    /erişimi reddedildi/,
  );
});
test("son stokta ikinci sipariş başarısız olur ve kupon kullanımı artmaz", (t) => {
  const s = fixture(t);
  const p = s.products().find((p) => p.id === "lucky");
  s.saveProduct({ ...p, stock: 1 }, "admin");
  s.createOrder(order(), null, "guest-a");
  assert.throws(() => s.createOrder(order(), null, "guest-b"), /yeterli stok/);
  assert.equal(s.coupons()[0].used, 1);
  assert.equal(s.products().find((p) => p.id === "lucky").stock, 0);
});
test("sipariş tutarı ürün değişse veya taslağa alınsa da korunur", (t) => {
  const s = fixture(t),
    o = s.createOrder(order(), null, "guest-a");
  const p = s.products().find((p) => p.id === "lucky");
  s.saveProduct({ ...p, price: 999000, published: false }, "admin");
  const saved = s.orders(null, "guest-a")[0];
  assert.equal(saved.total, o.total);
  assert.equal(saved.items[0].price, 189000);
  assert.equal(
    s.products().some((p) => p.id === "lucky"),
    false,
  );
  assert.equal(
    s.products(true).some((p) => p.id === "lucky"),
    true,
  );
});
test("fotoğrafa sahiplik ve sipariş durumuna izin verilen değerler denetlenir", (t) => {
  const s = fixture(t);
  s.addUpload("photo-one", "guest-a", "photo.png", "image/png");
  assert.throws(
    () =>
      s.calculate({ items: [{ ...item, uploadId: "photo-one" }] }, "guest-b"),
    /oturuma ait değil/,
  );
  const o = s.createOrder(order(), null, "guest-a");
  assert.throws(() => s.updateOrder(o.id, "paid", "admin"), /Geçersiz/);
  s.updateOrder(o.id, "designing", "admin");
  assert.equal(s.orders(null, "guest-a")[0].status, "designing");
});
test("kupon kullanım limiti ve minimum tutar korunur", (t) => {
  const s = fixture(t);
  s.saveCoupon(
    { code: "ONE", percent: 20, minimum: 150000, usageLimit: 1, active: true },
    "admin",
  );
  s.createOrder({ ...order(), coupon: "ONE" }, null, "guest-a");
  assert.throws(
    () => s.createOrder({ ...order(), coupon: "ONE" }, null, "guest-b"),
    /Kupon/,
  );
  assert.throws(
    () =>
      s.saveCoupon(
        { code: "BAD", percent: 99, minimum: 0, usageLimit: 10, active: true },
        "admin",
      ),
    /Geçersiz sayı/,
  );
});

test("kategori ve koleksiyon ayrı yönetilir, yeniden adlandırma ürün bağlantısını korur", (t) => {
  const s = fixture(t),
    category = s.saveTaxonomy(
      { type: "categories", name: "Çocuk ürünleri" },
      "admin",
    );
  const collection = s.saveTaxonomy(
    { type: "collections", name: "Yeni sezon" },
    "admin",
  );
  const product = s.products()[0];
  s.saveProduct(
    { ...product, category: category.id, collections: [collection.id] },
    "admin",
  );
  s.saveTaxonomy(
    {
      type: "categories",
      id: category.id,
      name: "Çocuk koleksiyonu değil, kategorisi",
    },
    "admin",
  );
  assert.equal(
    s.products().find((p) => p.id === product.id).category,
    category.id,
  );
  assert.deepEqual(s.products().find((p) => p.id === product.id).collections, [
    collection.id,
  ]);
  assert.throws(
    () => s.removeTaxonomy({ type: "categories", id: category.id }, "admin"),
    /ürün var/,
  );
  assert.throws(
    () => s.removeTaxonomy({ type: "collections", id: collection.id }, "admin"),
    /ürün var/,
  );
  assert.throws(
    () => s.saveTaxonomy({ type: "collections", name: "yeni sezon" }, "admin"),
    /zaten kullanılıyor/,
  );
});

test("boş gruplar kaldırılır, geçersiz ürün atamaları kaydedilmez", (t) => {
  const s = fixture(t),
    category = s.saveTaxonomy(
      { type: "categories", name: "Boş kategori" },
      "admin",
    );
  s.removeTaxonomy({ type: "categories", id: category.id }, "admin");
  assert.equal(
    s.taxonomy("categories").some((c) => c.id === category.id),
    false,
  );
  assert.throws(
    () => s.saveProduct({ ...s.products()[0], category: category.id }, "admin"),
    /kategori seç/,
  );
  assert.throws(
    () =>
      s.saveProduct({ ...s.products()[0], collections: ["missing"] }, "admin"),
    /Koleksiyon/,
  );
  assert.throws(
    () => s.saveTaxonomy({ type: "unknown", name: "Test" }, "admin"),
    /Geçersiz/,
  );
});

test("banner ve bilgi metni kaydedilir, harici çalıştırılabilir bağlantı reddedilir", (t) => {
  const s = fixture(t),
    settings = s.settings();
  const updated = {
    ...settings,
    banner: {
      ...settings.banner,
      title: "Yeni sezon",
      buttonLink: "#/urunler",
    },
    legalPages: settings.legalPages.map((p) =>
      p.id === "gizlilik" ? { ...p, body: "Yeni örnek gizlilik metni." } : p,
    ),
  };
  s.saveSettings(updated, "admin");
  assert.equal(s.settings().banner.title, "Yeni sezon");
  assert.equal(
    s.settings().legalPages.find((p) => p.id === "gizlilik").body,
    "Yeni örnek gizlilik metni.",
  );
  assert.throws(
    () =>
      s.saveSettings(
        {
          ...updated,
          banner: { ...updated.banner, buttonLink: "javascript:alert(1)" },
        },
        "admin",
      ),
    /Banner/,
  );
});

test("kategori fotoğrafı, bağlantı adı ve görünürlük kaydedilir", (t) => {
  const s = fixture(t),
    category = s.saveTaxonomy(
      {
        type: "categories",
        name: "Çocuk Ürünleri",
        slug: "cocuk-urunleri",
        image: "assets/cap.webp",
        active: false,
      },
      "admin",
    );
  const saved = s.taxonomy("categories").find((c) => c.id === category.id);
  assert.equal(saved.image, "assets/cap.webp");
  assert.equal(saved.slug, "cocuk-urunleri");
  assert.equal(saved.active, false);
  s.saveTaxonomy(
    { type: "categories", id: category.id, name: "Çocuklara özel" },
    "admin",
  );
  assert.equal(
    s.taxonomy("categories").find((c) => c.id === category.id).active,
    false,
  );
  assert.throws(
    () =>
      s.saveTaxonomy(
        { type: "categories", name: "Başka kategori", slug: "cocuk-urunleri" },
        "admin",
      ),
    /zaten kullanılıyor/,
  );
  assert.throws(
    () =>
      s.saveTaxonomy(
        {
          type: "categories",
          id: category.id,
          name: saved.name,
          image: "javascript:bad",
        },
        "admin",
      ),
    /fotoğraf/,
  );
});
