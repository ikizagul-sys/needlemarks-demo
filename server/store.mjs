import { normalizeContent, validateContent } from "../content-defaults.js";
import {
  defaultCategories,
  defaultCollections,
  taxonomyName,
  categoryDetails,
  productAssignments,
  assertRemovable,
} from "../catalog-rules.js";
import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const hash = (value) => createHash("sha256").update(value).digest("hex");
const encodePassword = (password) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
};
const checkPassword = (password, encoded) => {
  try {
    const [salt, key] = encoded.split(":");
    return timingSafeEqual(
      scryptSync(password, salt, 64),
      Buffer.from(key, "hex"),
    );
  } catch {
    return false;
  }
};
const clean = (value, max = 200) =>
  String(value ?? "")
    .trim()
    .slice(0, max);
const integer = (value, min = 0, max = 100000000) => {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new AppError("Geçersiz sayı.");
  return value;
};

export function createStore({ directory, seed, adminEmail, adminPassword }) {
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(join(directory, "store.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS taxonomy_meta(id INTEGER PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS taxonomies(type TEXT NOT NULL,id TEXT NOT NULL,body TEXT NOT NULL,PRIMARY KEY(type,id));
    CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY,body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS coupons(code TEXT PRIMARY KEY,body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'customer',createdAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,userId TEXT NOT NULL REFERENCES users(id),expiresAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,userId TEXT REFERENCES users(id),body TEXT NOT NULL,createdAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS uploads(id TEXT PRIMARY KEY,owner TEXT NOT NULL,file TEXT NOT NULL,mime TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,untilAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,createdAt TEXT NOT NULL);`);
  const row = (sql, ...args) => db.prepare(sql).get(...args);
  const rows = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const transaction = (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  for (const product of seed.products)
    run(
      "INSERT OR IGNORE INTO products VALUES (?,?)",
      product.id,
      JSON.stringify(product),
    );
  for (const coupon of seed.coupons)
    run(
      "INSERT OR IGNORE INTO coupons VALUES (?,?)",
      coupon.code,
      JSON.stringify(coupon),
    );
  run(
    "INSERT OR IGNORE INTO settings VALUES (1,?)",
    JSON.stringify(seed.settings),
  );
  if (!row("SELECT id FROM users WHERE role='admin'")) {
    const password = adminPassword || randomBytes(24).toString("base64url");
    const email = clean(adminEmail || "admin@needlemarks.local").toLowerCase();
    if (password.length < 12)
      throw new AppError("Yönetici parolası en az 12 karakter olmalı.");
    run(
      "INSERT INTO users VALUES (?,?,?,?,?,?)",
      randomUUID(),
      email,
      "NEEDLEMARKS Yönetici",
      encodePassword(password),
      "admin",
      new Date().toISOString(),
    );
    if (!adminPassword && !existsSync(join(directory, "admin-access.json")))
      writeFileSync(
        join(directory, "admin-access.json"),
        JSON.stringify({ email, password }, null, 2),
        { mode: 0o600 },
      );
  }
  const taxonomy = (type) =>
    rows("SELECT body FROM taxonomies WHERE type=? ORDER BY rowid", type).map(
      (record) => JSON.parse(record.body),
    );
  if (!row("SELECT id FROM taxonomy_meta WHERE id=1"))
    transaction(() => {
      for (const [type, records] of [
        ["categories", seed.categories || defaultCategories],
        ["collections", seed.collections || defaultCollections],
      ])
        for (const record of records)
          run(
            "INSERT OR IGNORE INTO taxonomies VALUES (?,?,?)",
            type,
            record.id,
            JSON.stringify(record),
          );
      for (const record of rows("SELECT id,body FROM products")) {
        const product = JSON.parse(record.body);
        if (!Array.isArray(product.collections)) {
          product.collections =
            seed.products.find((p) => p.id === product.id)?.collections || [];
          run(
            "UPDATE products SET body=? WHERE id=?",
            JSON.stringify(product),
            product.id,
          );
        }
      }
      run("INSERT INTO taxonomy_meta VALUES (1)");
    });
  const products = (admin = false) =>
    rows("SELECT body FROM products")
      .map((r) => JSON.parse(r.body))
      .filter((p) => admin || p.published);
  const settings = () =>
    normalizeContent(
      JSON.parse(row("SELECT body FROM settings WHERE id=1").body),
    );
  const coupons = () =>
    rows("SELECT body FROM coupons").map((r) => JSON.parse(r.body));
  const publicUser = (user) =>
    user
      ? { id: user.id, email: user.email, name: user.name, role: user.role }
      : null;
  const audit = (actor, action) =>
    run(
      "INSERT INTO audit VALUES (?,?,?,?)",
      randomUUID(),
      actor,
      action,
      new Date().toISOString(),
    );
  function session(token) {
    if (!token) return null;
    const result = row(
      "SELECT u.* FROM sessions s JOIN users u ON u.id=s.userId WHERE s.token=? AND s.expiresAt>?",
      hash(token),
      Date.now(),
    );
    return publicUser(result);
  }
  function authenticate(email, password, ip) {
    email = clean(email).toLowerCase();
    password = String(password ?? "");
    if (password.length > 256)
      throw new AppError("E-posta veya parola hatalı.", 401);
    const key = hash(ip + ":" + email),
      attempt = row("SELECT * FROM attempts WHERE key=?", key);
    if (attempt && attempt.untilAt > Date.now() && attempt.count >= 8)
      throw new AppError("Çok fazla deneme. 15 dakika sonra tekrar dene.", 429);
    const user = row("SELECT * FROM users WHERE email=?", email);
    const valid = checkPassword(
      password,
      user?.password ?? `00000000000000000000000000000000:${"0".repeat(128)}`,
    );
    if (!user || !valid) {
      run(
        "INSERT INTO attempts VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,untilAt=excluded.untilAt",
        key,
        attempt && attempt.untilAt > Date.now() ? attempt.count + 1 : 1,
        Date.now() + 900000,
      );
      throw new AppError("E-posta veya parola hatalı.", 401);
    }
    run("DELETE FROM attempts WHERE key=?", key);
    return newSession(user);
  }
  function newSession(user) {
    const token = randomBytes(32).toString("base64url");
    run("DELETE FROM sessions WHERE expiresAt<?", Date.now());
    run(
      "INSERT INTO sessions VALUES (?,?,?)",
      hash(token),
      user.id,
      Date.now() + 7 * 86400000,
    );
    return { token, user: publicUser(user) };
  }
  function register(data) {
    const email = clean(data.email).toLowerCase(),
      name = clean(data.name, 100),
      password = String(data.password ?? "");
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      name.length < 2 ||
      password.length < 12 ||
      password.length > 128
    )
      throw new AppError(
        "Geçerli e-posta, ad ve en az 12 karakterli parola gir.",
      );
    if (row("SELECT id FROM users WHERE email=?", email))
      throw new AppError("Bu e-posta ile hesap oluşturulamıyor.");
    const user = {
      id: randomUUID(),
      email,
      name,
      role: "customer",
      createdAt: new Date().toISOString(),
    };
    run(
      "INSERT INTO users VALUES (?,?,?,?,?,?)",
      user.id,
      email,
      name,
      encodePassword(password),
      user.role,
      user.createdAt,
    );
    return newSession(user);
  }
  function calculate(data, owner) {
    if (
      !Array.isArray(data.items) ||
      !data.items.length ||
      data.items.length > 30
    )
      throw new AppError("Sepetin boş veya ürün sınırını aşıyor.");
    const catalog = products();
    const demand = new Map();
    const items = data.items.map((item) => {
      const p = catalog.find((p) => p.id === item.id);
      if (!p) throw new AppError("Bir ürün artık satışta değil.");
      const quantity = integer(item.quantity, 1, 20);
      demand.set(p.id, (demand.get(p.id) || 0) + quantity);
      if (demand.get(p.id) > p.stock)
        throw new AppError(`${p.kind} için yeterli stok yok.`);
      if (!p.colors.includes(item.color) || !p.sizes.includes(item.size))
        throw new AppError("Renk veya beden geçerli değil.");
      if (
        item.uploadId &&
        !row(
          "SELECT id FROM uploads WHERE id=? AND owner=?",
          clean(item.uploadId),
          owner,
        )
      )
        throw new AppError("Fotoğraf bu oturuma ait değil.");
      return {
        id: p.id,
        name: p.name,
        kind: p.kind,
        image: p.image,
        price: p.price,
        quantity,
        color: item.color,
        size: item.size,
        note: clean(item.note, 180),
        uploadId: item.uploadId || null,
      };
    });
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    let discount = 0,
      coupon = null;
    if (data.coupon) {
      coupon = coupons().find(
        (c) => c.code === clean(data.coupon, 30).toUpperCase(),
      );
      if (
        !coupon ||
        !coupon.active ||
        subtotal < coupon.minimum ||
        coupon.used >= coupon.usageLimit
      )
        throw new AppError(
          "Kupon geçersiz, süresi dolmuş veya sepet koşulu sağlanmadı.",
        );
      discount = Math.floor((subtotal * coupon.percent) / 100);
    }
    const config = settings(),
      shipping =
        subtotal - discount >= config.freeShippingThreshold
          ? 0
          : config.shippingFee;
    return {
      items,
      subtotal,
      discount,
      shipping,
      total: subtotal - discount + shipping,
      coupon: coupon?.code || null,
    };
  }
  function createOrder(data, user, owner) {
    return transaction(() => {
      const key = clean(data.idempotencyKey, 100);
      if (!/^[a-zA-Z0-9_-]{16,100}$/.test(key))
        throw new AppError("Sipariş anahtarı geçersiz.");
      const existing = row("SELECT body FROM orders WHERE id=?", key);
      if (existing) {
        const order = JSON.parse(existing.body);
        if (order.owner !== owner)
          throw new AppError("Sipariş erişimi reddedildi.", 403);
        return order;
      }
      const customer = {
        name: clean(data.customer?.name, 100),
        email: clean(data.customer?.email, 160).toLowerCase(),
        phone: clean(data.customer?.phone, 30),
        city: clean(data.customer?.city, 60),
        district: clean(data.customer?.district, 80),
        address: clean(data.customer?.address, 400),
      };
      if (
        customer.name.length < 3 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email) ||
        customer.phone.replace(/\D/g, "").length < 10 ||
        !customer.city ||
        customer.district.length < 2 ||
        customer.address.length < 10 ||
        data.consent !== true
      )
        throw new AppError(
          "Teslimat bilgilerini ve demo bilgilendirmesini tamamla.",
        );
      const amounts = calculate(data, owner),
        id = key,
        createdAt = new Date().toISOString();
      for (const item of amounts.items) {
        const p = JSON.parse(
          row("SELECT body FROM products WHERE id=?", item.id).body,
        );
        p.stock -= item.quantity;
        run("UPDATE products SET body=? WHERE id=?", JSON.stringify(p), p.id);
      }
      if (amounts.coupon) {
        const coupon = coupons().find((c) => c.code === amounts.coupon);
        coupon.used++;
        run(
          "UPDATE coupons SET body=? WHERE code=?",
          JSON.stringify(coupon),
          coupon.code,
        );
      }
      const order = {
        id,
        number:
          "NM-" +
          Date.now().toString(36).toUpperCase() +
          "-" +
          randomBytes(2).toString("hex").toUpperCase(),
        userId: user?.id || null,
        owner,
        customer,
        ...amounts,
        status: "demo-received",
        paymentStatus: "demo-unpaid",
        createdAt,
      };
      run(
        "INSERT INTO orders VALUES (?,?,?,?)",
        id,
        user?.id || null,
        JSON.stringify(order),
        createdAt,
      );
      return order;
    });
  }
  function orders(user, owner) {
    return rows("SELECT body FROM orders ORDER BY createdAt DESC LIMIT 500")
      .map((r) => JSON.parse(r.body))
      .filter(
        (o) =>
          user?.role === "admin" ||
          (user && o.userId === user.id) ||
          o.owner === owner,
      )
      .map(({ owner, ...order }) => order);
  }
  const validImage = (value) =>
    /^(assets\/[a-zA-Z0-9._-]+|media\/[a-f0-9-]+)\.(webp|png|jpg)$/.test(value);
  function saveProduct(data, actor) {
    const id = clean(data.id, 80) || randomUUID(),
      existing = products(true).find((p) => p.id === id);
    const p = {
      ...existing,
      id,
      name: clean(data.name, 140),
      kind: clean(data.kind, 100),
      category: clean(data.category, 80),
      collections: data.collections ?? existing?.collections ?? [],
      type: clean(data.type, 50) || "Ürün",
      description: clean(data.description, 3000),
      material: clean(data.material, 600),
      care: clean(data.care, 600),
      price: integer(data.price, 1),
      stock: integer(data.stock, 0, 100000),
      image: clean(data.image, 200),
      images: Array.isArray(data.images)
        ? data.images.map((v) => clean(v, 200)).slice(0, 8)
        : [clean(data.image, 200)],
      colors: Array.isArray(data.colors)
        ? data.colors
            .map((c) => clean(c, 30))
            .filter(Boolean)
            .slice(0, 12)
        : [],
      sizes: Array.isArray(data.sizes)
        ? data.sizes
            .map((c) => clean(c, 30))
            .filter(Boolean)
            .slice(0, 12)
        : [],
      published: data.published === true,
      featured: data.featured === true,
      badge: clean(data.badge, 50),
      slug: clean(data.slug, 100) || id,
      swatches: existing?.swatches || ["#d8cfb9"],
    };
    if (
      !p.name ||
      !p.kind ||
      !p.colors.length ||
      !p.sizes.length ||
      !validImage(p.image) ||
      p.images.some((v) => !validImage(v))
    )
      throw new AppError(
        "Ürün adı, kategori, seçenek ve görsel alanlarını kontrol et.",
      );
    try {
      p.collections = productAssignments(
        p,
        taxonomy("categories"),
        taxonomy("collections"),
      );
    } catch (error) {
      throw new AppError(error.message);
    }
    run(
      "INSERT INTO products VALUES (?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
      id,
      JSON.stringify(p),
    );
    audit(actor, "product:" + id);
    return p;
  }
  function saveTaxonomy(data, actor) {
    if (!["categories", "collections"].includes(data.type))
      throw new AppError("Geçersiz bölüm.");
    const id = clean(data.id, 80) || randomUUID();
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || id === "all")
      throw new AppError("Geçersiz kayıt.");
    let name;
    try {
      name = taxonomyName(data.name, taxonomy(data.type), id);
    } catch (error) {
      throw new AppError(error.message);
    }
    let record;
    try {
      record =
        data.type === "categories"
          ? categoryDetails(data, taxonomy(data.type), id)
          : { id, name };
    } catch (error) {
      throw new AppError(error.message);
    }
    run(
      "INSERT INTO taxonomies VALUES (?,?,?) ON CONFLICT(type,id) DO UPDATE SET body=excluded.body",
      data.type,
      id,
      JSON.stringify(record),
    );
    audit(actor, data.type + ":" + id);
    return record;
  }
  function removeTaxonomy(data, actor) {
    if (!["categories", "collections"].includes(data.type))
      throw new AppError("Geçersiz bölüm.");
    if (!taxonomy(data.type).some((record) => record.id === data.id))
      throw new AppError("Kayıt bulunamadı.", 404);
    try {
      assertRemovable(products(true), data.type, data.id);
    } catch (error) {
      throw new AppError(error.message);
    }
    run("DELETE FROM taxonomies WHERE type=? AND id=?", data.type, data.id);
    audit(actor, "remove:" + data.type + ":" + data.id);
    return { ok: true };
  }
  function updateOrder(id, status, actor) {
    if (
      ![
        "demo-received",
        "designing",
        "production",
        "shipped",
        "completed",
      ].includes(status)
    )
      throw new AppError("Geçersiz sipariş durumu.");
    const record = row("SELECT body FROM orders WHERE id=?", id);
    if (!record) throw new AppError("Sipariş bulunamadı.", 404);
    const order = JSON.parse(record.body);
    order.status = status;
    run("UPDATE orders SET body=? WHERE id=?", JSON.stringify(order), id);
    audit(actor, `order:${id}:${status}`);
    return order;
  }
  function saveSettings(data, actor) {
    let config = {
      ...settings(),
      banner: data.banner ?? settings().banner,
      legalPages: data.legalPages ?? settings().legalPages,
      announcement: clean(data.announcement, 200),
      shippingFee: integer(data.shippingFee),
      freeShippingThreshold: integer(data.freeShippingThreshold),
      preparationDays: clean(data.preparationDays, 80),
      about: clean(data.about, 2000),
      supportEmail: clean(data.supportEmail, 160),
    };
    try {
      config = validateContent(config, validImage);
    } catch (error) {
      throw new AppError(error.message);
    }
    run("UPDATE settings SET body=? WHERE id=1", JSON.stringify(config));
    audit(actor, "settings");
    return config;
  }
  function saveCoupon(data, actor) {
    const code = clean(data.code, 30).toUpperCase();
    if (!/^[A-Z0-9_-]{3,30}$/.test(code))
      throw new AppError("Kupon kodu 3–30 Latin harf/rakam içermeli.");
    const existing = coupons().find((c) => c.code === code);
    const coupon = {
      code,
      percent: integer(data.percent, 1, 70),
      minimum: integer(data.minimum),
      usageLimit: integer(data.usageLimit, 1, 100000),
      used: existing?.used || 0,
      active: data.active === true,
    };
    run(
      "INSERT INTO coupons VALUES (?,?) ON CONFLICT(code) DO UPDATE SET body=excluded.body",
      code,
      JSON.stringify(coupon),
    );
    audit(actor, "coupon:" + code);
    return coupon;
  }
  return {
    db,
    products,
    settings,
    coupons,
    session,
    authenticate,
    register,
    calculate,
    createOrder,
    orders,
    saveProduct,
    taxonomy,
    saveTaxonomy,
    removeTaxonomy,
    updateOrder,
    saveSettings,
    saveCoupon,
    logout: (token) =>
      run("DELETE FROM sessions WHERE token=?", hash(token || "")),
    customers: () =>
      rows(
        "SELECT id,name,email,createdAt FROM users WHERE role='customer' ORDER BY createdAt DESC LIMIT 500",
      ),
    addUpload: (id, owner, file, mime) =>
      run("INSERT INTO uploads VALUES (?,?,?,?)", id, owner, file, mime),
    upload: (id, owner, admin) =>
      admin
        ? row("SELECT * FROM uploads WHERE id=?", id)
        : row("SELECT * FROM uploads WHERE id=? AND owner=?", id, owner),
    close: () => db.close(),
  };
}
