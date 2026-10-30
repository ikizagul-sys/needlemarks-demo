import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, basename, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createStore } from "../server/store.mjs";
import {
  normalizeOptions,
  resolveOptions,
  variantKey,
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
test('temiz tarayıcıda demo açılır ve kişiselleştirme siparişi oluşturulur',()=>{
  const script=`
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
    S.cart.push({id:p.id,key:'sample',quantity:1,color:p.colors[0],size:p.sizes[0],selections:{placement:'İki kol'},answers:{'right-name':'Milo','left-name':'Luna',thread:'Bordo',photos:[]}});
    assert.equal(S.quoteLocal().subtotal,p.price);
    const order=await S.placeOrder({idempotencyKey:'fresh-browser-test',customer:{name:'Deniz Örnek'}});
    assert.equal(order.items[0].optionSelections[0].value,'İki kol');
    assert.equal(order.items[0].optionAnswers[0].value,'Milo');
    assert.equal(S.cart.length,0);
  `;
  const result=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
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
