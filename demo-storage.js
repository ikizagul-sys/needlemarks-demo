// Demo metadata and binary images share one origin-local IndexedDB database.
const keys = [
  "products",
  "settings",
  "coupons",
  "categories",
  "collections",
  "orders",
  "cart",
  "user",
  "favorites",
];
const cache = new Map(),
  blobs = new Map(),
  urls = new Map(),
  ids = new Map();
let db,
  queue = Promise.resolve();
const message =
  "Bu tarayıcı kayıt alanına erişemiyor veya cihazda yeterli boş alan yok. Tarayıcıda bu site için depolamaya izin verip tekrar dene. Mevcut kayıtları silmen gerekmez.";
const legacy = (key) => {
  try {
    return localStorage.getItem("nm2-" + key);
  } catch {
    return null;
  }
};
const request = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
const finished = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error(message));
  });
function mapValue(value, transform) {
  if (typeof value === "string") return transform(value);
  if (Array.isArray(value))
    return value.map((item) => mapValue(item, transform));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        mapValue(item, transform),
      ]),
    );
  return value;
}
function imageURL(id) {
  if (!urls.has(id) && blobs.has(id)) {
    const url = URL.createObjectURL(blobs.get(id));
    urls.set(id, url);
    ids.set(url, id);
  }
  return urls.get(id) || "";
}
const decode = (value) =>
  mapValue(value, (text) =>
    text.startsWith("nm-image:") ? imageURL(text.slice(9)) : text,
  );
const encode = (value) =>
  mapValue(value, (text) =>
    ids.has(text) ? "nm-image:" + ids.get(text) : text,
  );
function dataBlob(value) {
  const [, type, base64] =
    value.match(/^data:(image\/(?:png|jpeg|webp));base64,([\s\S]+)$/) || [];
  if (!type) return null;
  const bytes = atob(base64),
    array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
  return new Blob([array], { type });
}
export async function initialize() {
  if (typeof indexedDB === "undefined") return;
  try {
    db = await new Promise((resolve, reject) => {
      const open = indexedDB.open("needlemarks-demo", 1),
        timer = setTimeout(() => reject(new Error(message)), 3000);
      open.onupgradeneeded = () => {
        open.result.createObjectStore("records", { keyPath: "key" });
        open.result.createObjectStore("images", { keyPath: "id" });
      };
      open.onsuccess = () => {
        clearTimeout(timer);
        resolve(open.result);
      };
      open.onerror = () => {
        clearTimeout(timer);
        reject(open.error);
      };
    });
    const tx = db.transaction(["records", "images"], "readonly"),
      done = finished(tx);
    const [records, images] = await Promise.all([
      request(tx.objectStore("records").getAll()),
      request(tx.objectStore("images").getAll()),
    ]);
    await done;
    for (const image of images) blobs.set(image.id, image.blob);
    for (const record of records) cache.set(record.key, record.value);
    const migrated = [],
      created = [],
      dedup = new Map();
    for (const key of keys) {
      const raw = legacy(key);
      if (raw === null) continue;
      if (!cache.has(key)) {
        let value;
        try {
          value = JSON.parse(raw);
        } catch {
          continue;
        }
        value = mapValue(value, (text) => {
          if (!text.startsWith("data:image/")) return text;
          if (dedup.has(text)) return "nm-image:" + dedup.get(text);
          const blob = dataBlob(text);
          if (!blob) return text;
          const id = crypto.randomUUID();
          created.push({ id, blob });
          dedup.set(text, id);
          return "nm-image:" + id;
        });
        migrated.push({ key, value, raw });
      }
    }
    if (migrated.length) {
      const tx = db.transaction(["records", "images"], "readwrite"),
        done = finished(tx);
      for (const image of created) tx.objectStore("images").put(image);
      for (const { key, value } of migrated)
        tx.objectStore("records").put({ key, value });
      await done;
      for (const image of created) blobs.set(image.id, image.blob);
      for (const { key, value, raw } of migrated) {
        cache.set(key, value);
        try {
          if (legacy(key) === raw) localStorage.removeItem("nm2-" + key);
        } catch {}
      }
    }
  } catch {
    db?.close();
    db = null;
    cache.clear();
  }
}
export function read(key, fallback) {
  if (cache.has(key)) return decode(cache.get(key)) ?? fallback;
  try {
    return JSON.parse(legacy(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
export function writeMany(values) {
  // Capture immutable metadata now; image bytes never enter these JSON records.
  const encoded = encode(values);
  const pending = queue
    .catch(() => {})
    .then(async () => {
      try {
        if (db) {
          const tx = db.transaction("records", "readwrite"),
            done = finished(tx);
          for (const [key, value] of Object.entries(encoded))
            tx.objectStore("records").put({ key, value });
          await done;
        } else {
          for (const [key, value] of Object.entries(encoded))
            localStorage.setItem("nm2-" + key, JSON.stringify(value));
        }
        for (const [key, value] of Object.entries(encoded))
          cache.set(key, value);
      } catch {
        throw new Error(message);
      }
    });
  queue = pending;
  pending.catch(() => {});
  return pending;
}
export const write = (key, value) => writeMany({ [key]: value });
export function validatePhoto(file) {
  if (
    !file ||
    !file.size ||
    file.size > 5 * 1024 * 1024 ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.type)
  )
    throw new Error(
      "JPG, PNG veya WebP fotoğraf seç. Her fotoğraf en fazla 5 MB olabilir.",
    );
}
export function moveToCover(images, index) {
  if (!Number.isInteger(index) || index < 0 || index >= images.length)
    throw new Error("Vitrin için geçerli bir galeri görseli seç.");
  return [images[index], ...images.filter((_, i) => i !== index)];
}
export async function putImage(file) {
  validatePhoto(file);
  if (!db) throw new Error(message);
  const id = crypto.randomUUID(),
    tx = db.transaction("images", "readwrite"),
    done = finished(tx);
  tx.objectStore("images").put({ id, blob: file });
  try {
    await done;
  } catch {
    throw new Error(message);
  }
  blobs.set(id, file);
  return imageURL(id);
}
export const ownsImage = (url) => ids.has(url);
export async function clear() {
  await queue.catch(() => {});
  if (db) {
    const tx = db.transaction(["records", "images"], "readwrite"),
      done = finished(tx);
    tx.objectStore("records").clear();
    tx.objectStore("images").clear();
    await done;
  }
  for (const key of keys)
    try {
      localStorage.removeItem("nm2-" + key);
    } catch {}
  for (const url of urls.values()) URL.revokeObjectURL(url);
  cache.clear();
  blobs.clear();
  urls.clear();
  ids.clear();
}
