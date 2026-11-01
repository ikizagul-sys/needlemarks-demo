import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";
import { createStore, AppError } from "./store.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const local = resolve(process.env.DATA_DIRECTORY || join(root, ".local"));
const seed = JSON.parse(
  await readFile(join(root, "data/catalog.json"), "utf8"),
);
const store = createStore({
  directory: local,
  seed,
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
});
await mkdir(join(local, "uploads"), { recursive: true });
await mkdir(join(local, "product-images"), { recursive: true });
const port = Number(process.env.PORT || 4185),
  host = process.env.HOST || "127.0.0.1";
const origin = process.env.APP_URL || `http://${host}:${port}`;
const secure = origin.startsWith("https:");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
};
function send(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}
function cookie(name, value, age = 604800) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? "; Secure" : ""}`;
}
async function body(req) {
  let length = 0;
  const chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 7500000)
      throw new AppError("Dosya veya istek çok büyük.", 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new AppError("Geçersiz JSON.");
  }
}
function requireAdmin(user) {
  if (user?.role !== "admin")
    throw new AppError("Yönetici girişi gerekli.", 403);
}
const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
  );
  try {
    const url = new URL(req.url, origin),
      path = decodeURIComponent(url.pathname);
    const cookies = Object.fromEntries(
      (req.headers.cookie || "")
        .split(";")
        .filter(Boolean)
        .map((v) => v.trim().split("=")),
    );
    const user = store.session(cookies.nm_session);
    let owner = user?.id || cookies.nm_guest;
    if (!owner || !/^[a-zA-Z0-9_-]{20,80}$/.test(owner)) {
      owner = randomBytes(24).toString("base64url");
      res.setHeader("Set-Cookie", cookie("nm_guest", owner));
    }
    if (path.startsWith("/api/")) {
      const mutation = !["GET", "HEAD"].includes(req.method);
      if (mutation) {
        if (req.headers.origin !== origin && req.headers.origin !== undefined)
          throw new AppError("İstek kaynağı reddedildi.", 403);
        if (!req.headers["content-type"]?.startsWith("application/json"))
          throw new AppError("JSON isteği gerekli.", 415);
        if (req.headers["x-needlemarks"] !== "1")
          throw new AppError("İstek başlığı gerekli.", 403);
      }
      if (req.method === "GET" && path === "/api/health")
        return send(res, 200, {
          ok: true,
          mode: "server",
          payments: "disabled",
        });
      if (req.method === "GET" && path === "/api/catalog")
        return send(res, 200, {
          products: store.products(),
          categories: store.taxonomy("categories"),
          collections: store.taxonomy("collections"),
          settings: store.settings(),
        });
      if (req.method === "GET" && path === "/api/session")
        return send(res, 200, { user });
      if (
        req.method === "POST" &&
        ["/api/login", "/api/register"].includes(path)
      ) {
        const data = await body(req);
        const result = path.endsWith("register")
          ? store.register(data)
          : store.authenticate(
              data.email,
              data.password,
              req.socket.remoteAddress,
            );
        res.setHeader("Set-Cookie", cookie("nm_session", result.token));
        return send(res, 200, { user: result.user });
      }
      if (req.method === "POST" && path === "/api/logout") {
        store.logout(cookies.nm_session);
        res.setHeader("Set-Cookie", cookie("nm_session", "", 0));
        return send(res, 200, { ok: true });
      }
      if (req.method === "POST" && path === "/api/quote")
        return send(res, 200, store.calculate(await body(req), owner));
      if (req.method === "POST" && path === "/api/orders")
        return send(res, 201, store.createOrder(await body(req), user, owner));
      if (req.method === "GET" && path === "/api/orders")
        return send(res, 200, store.orders(user, owner));
      if (req.method === "POST" && path === "/api/uploads") {
        const data = await body(req),
          buffer = Buffer.from(String(data.base64 || ""), "base64");
        if (!buffer.length || buffer.length > 5 * 1024 * 1024)
          throw new AppError("Fotoğraf en fazla 5 MB olabilir.");
        let mime, extension;
        if (
          buffer
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ) {
          mime = "image/png";
          extension = "png";
        } else if (
          buffer[0] === 255 &&
          buffer[1] === 216 &&
          buffer[2] === 255
        ) {
          mime = "image/jpeg";
          extension = "jpg";
        } else if (
          buffer.toString("ascii", 0, 4) === "RIFF" &&
          buffer.toString("ascii", 8, 12) === "WEBP"
        ) {
          mime = "image/webp";
          extension = "webp";
        } else throw new AppError("Yalnızca PNG, JPEG veya WebP kabul edilir.");
        const id = randomUUID(),
          file = id + "." + extension;
        await writeFile(join(local, "uploads", file), buffer, { flag: "wx" });
        store.addUpload(id, owner, file, mime);
        return send(res, 201, { id });
      }
      if (path.startsWith("/api/uploads/") && req.method === "GET") {
        const upload = store.upload(
          path.split("/").at(-1),
          owner,
          user?.role === "admin",
        );
        if (!upload) throw new AppError("Fotoğraf bulunamadı.", 404);
        const content = await readFile(join(local, "uploads", upload.file));
        res.writeHead(200, {
          "Content-Type": upload.mime,
          "Cache-Control": "private, no-store",
          "Content-Disposition": "inline",
        });
        return res.end(content);
      }
      if (path.startsWith("/api/admin/")) {
        requireAdmin(user);
        if (req.method === "POST" && path === "/api/admin/images") {
          const data = await body(req),
            buffer = Buffer.from(String(data.base64 || ""), "base64");
          if (!buffer.length || buffer.length > 5 * 1024 * 1024)
            throw new AppError("Fotoğraf en fazla 5 MB olabilir.");
          let extension;
          if (
            buffer
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          )
            extension = "png";
          else if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)
            extension = "jpg";
          else if (
            buffer.toString("ascii", 0, 4) === "RIFF" &&
            buffer.toString("ascii", 8, 12) === "WEBP"
          )
            extension = "webp";
          else throw new AppError("Yalnızca PNG, JPEG veya WebP kabul edilir.");
          const file = randomUUID() + "." + extension;
          await writeFile(join(local, "product-images", file), buffer, {
            flag: "wx",
          });
          return send(res, 201, { image: "media/" + file });
        }
        if (req.method === "GET" && path === "/api/admin/data")
          return send(res, 200, {
            products: store.products(true),
            categories: store.taxonomy("categories"),
            collections: store.taxonomy("collections"),
            orders: store.orders(user, owner),
            customers: store.customers(),
            coupons: store.coupons(),
            settings: store.settings(),
          });
        if (req.method === "POST" && path === "/api/admin/taxonomies")
          return send(res, 200, store.saveTaxonomy(await body(req), user.id));
        if (req.method === "POST" && path === "/api/admin/taxonomies/remove")
          return send(res, 200, store.removeTaxonomy(await body(req), user.id));
        if (req.method === "POST" && path === "/api/admin/products")
          return send(res, 200, store.saveProduct(await body(req), user.id));
        if (req.method === "POST" && path === "/api/admin/orders") {
          const data = await body(req);
          return send(
            res,
            200,
            store.updateOrder(data.id, data.status, user.id),
          );
        }
        if (req.method === "POST" && path === "/api/admin/settings")
          return send(res, 200, store.saveSettings(await body(req), user.id));
        if (req.method === "POST" && path === "/api/admin/coupons")
          return send(res, 200, store.saveCoupon(await body(req), user.id));
      }
      throw new AppError("İşlem bulunamadı.", 404);
    }
    if (
      /^\/media\/[a-f0-9-]+\.(png|jpg|webp)$/.test(path) &&
      req.method === "GET"
    ) {
      const content = await readFile(
        join(local, "product-images", path.split("/").at(-1)),
      );
      res.writeHead(200, {
        "Content-Type": types[extname(path)],
        "Cache-Control": "public, max-age=3600",
      });
      return res.end(content);
    }
    if (!["GET", "HEAD"].includes(req.method))
      throw new AppError("Yöntem desteklenmiyor.", 405);
    if (path === "/config.js") {
      res.writeHead(200, {
        "Content-Type": types[".js"],
        "Cache-Control": "no-store",
      });
      return res.end("window.NEEDLEMARKS_CONFIG={mode:'server'};");
    }
    let file = path === "/" ? "index.html" : path.slice(1);
    if (
      ![
        "index.html",
        "styles.css",
        "app.js",
        "product-options.js",
        "options-ui.js",
        "variation-media.js",
        "variation-editor.js",
        "data.js",
        "demo-storage.js",
        "catalog-rules.js",
        "admin-catalog.js",
        "content-defaults.js",
        "store-content.js",
        "config.js",
        "data/catalog.json",
      ].includes(file) &&
      !/^assets\/[a-zA-Z0-9._-]+$/.test(file)
    )
      throw new AppError("Sayfa bulunamadı.", 404);
    const content = await readFile(join(root, file));
    res.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
      "Cache-Control": file.startsWith("assets/")
        ? "public, max-age=3600"
        : "no-cache",
    });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch (error) {
    send(
      res,
      error instanceof AppError
        ? error.status
        : error.code === "ENOENT"
          ? 404
          : 500,
      {
        error:
          error instanceof AppError
            ? error.message
            : error.code === "ENOENT"
              ? "Dosya bulunamadı."
              : "İşlem tamamlanamadı.",
      },
    );
  }
});
server.listen(port, host, () =>
  console.log(
    `NEEDLEMARKS: ${origin}\nGerçek ödeme kapalı. İlk yönetici erişimi: .local/admin-access.json (yalnızca yerel).`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      store.close();
      process.exit(0);
    }),
  );
