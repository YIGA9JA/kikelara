// server.js (MERGED - PRODUCTION READY + PRODUCTS UPLOADS)
// Render backend: https://kikelara.onrender.com
// Vercel frontend: https://kikelara.vercel.app

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const helmet = require("helmet");
const compression = require("compression");
const multer = require("multer");

try { require("dotenv").config(); } catch {}

const app = express();
const PORT = process.env.PORT || 4000;

/* ===================== CONFIG ===================== */
const ADMIN_CODE = process.env.ADMIN_CODE || "4567";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "CHANGE_ME_SUPER_SECRET";

// Your frontend domain(s)
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// Default origins if env not set:
const ALLOW_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "https://kikelara.vercel.app",
  "https://www.kikelara.vercel.app",
  ...FRONTEND_ORIGINS
];

/* ===================== MIDDLEWARE ===================== */
app.set("trust proxy", 1);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());

app.use(cors({
  origin: function (origin, cb) {
    if (!origin) return cb(null, true);
    if (ALLOW_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS: " + origin));
  },
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* ===================== PATHS ===================== */
const dataDir = path.join(__dirname, "data");
const uploadsDir = path.join(__dirname, "uploads");

const ordersFile = path.join(dataDir, "orders.json");
const pricingFile = path.join(dataDir, "deliveryPricing.json");
const messagesFile = path.join(dataDir, "messages.json");
const productsFile = path.join(dataDir, "products.json");

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use("/uploads", express.static(uploadsDir)); // ✅ serve uploaded files

ensureJsonFile(ordersFile, []);
ensureJsonFile(messagesFile, []);
ensureJsonFile(pricingFile, buildDefaultNigeriaPricing(5000));
ensureJsonFile(productsFile, []);

/* ===================== FILE HELPERS ===================== */
function ensureJsonFile(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), "utf-8");
  }
}
function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function writeJsonAtomic(filePath, data) {
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, filePath);
}
function nextId(list) {
  return list.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0) + 1;
}

/* ===================== ADMIN AUTH (TOKEN) ===================== */
function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
function unbase64url(input) {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf-8");
}
function sign(payloadB64) {
  return crypto
    .createHmac("sha256", ADMIN_SECRET)
    .update(payloadB64)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
function createToken(payloadObj) {
  const payloadStr = JSON.stringify(payloadObj);
  const payloadB64 = base64url(payloadStr);
  const signature = sign(payloadB64);
  return `${payloadB64}.${signature}`;
}
function verifyToken(token) {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, sig] = parts;
  const expected = sign(payloadB64);
  if (sig !== expected) return null;

  try {
    const payload = JSON.parse(unbase64url(payloadB64));
    if (payload?.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const payload = verifyToken(token);

  if (!payload || payload.role !== "admin") {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  req.admin = payload;
  next();
}

/* ===================== HEALTH ===================== */
app.get("/health", (req, res) => res.json({ ok: true, uptime: process.uptime() }));

/* ===================== ADMIN LOGIN ===================== */
app.post("/admin/login", (req, res) => {
  const code = String(req.body?.code || "").trim();
  if (!code) return res.status(400).json({ success: false, message: "Missing code" });
  if (code !== ADMIN_CODE) return res.status(401).json({ success: false, message: "Invalid code" });

  const token = createToken({
    role: "admin",
    iat: Date.now(),
    exp: Date.now() + 1000 * 60 * 60 * 12 // 12 hours
  });

  res.json({ success: true, token });
});
app.get("/admin/me", requireAdmin, (req, res) => {
  res.json({ success: true, admin: req.admin });
});

/* ===================== DELIVERY PRICING ===================== */
app.get("/delivery-pricing", (req, res) => {
  const pricing = readJson(pricingFile, buildDefaultNigeriaPricing(5000));
  res.json(pricing);
});
app.get("/admin/delivery-pricing", requireAdmin, (req, res) => {
  const pricing = readJson(pricingFile, buildDefaultNigeriaPricing(5000));
  res.json({ success: true, pricing });
});
app.put("/admin/delivery-pricing", requireAdmin, (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object") {
    return res.status(400).json({ success: false, message: "Invalid payload" });
  }
  const cleaned = sanitizePricing(body);
  cleaned.updatedAt = new Date().toISOString();
  writeJsonAtomic(pricingFile, cleaned);
  res.json({ success: true, pricing: cleaned });
});
app.post("/admin/delivery-pricing/seed", requireAdmin, (req, res) => {
  const fee = Number(req.body?.fee);
  const seedFee = Number.isFinite(fee) && fee >= 0 ? Math.round(fee) : 5000;
  const seeded = buildDefaultNigeriaPricing(seedFee);
  seeded.updatedAt = new Date().toISOString();
  writeJsonAtomic(pricingFile, seeded);
  res.json({ success: true, pricing: seeded });
});
function sanitizePricing(input) {
  const out = { defaultFee: 5000, updatedAt: new Date().toISOString(), states: [] };
  const def = Number(input.defaultFee);
  out.defaultFee = Number.isFinite(def) && def >= 0 ? Math.round(def) : 5000;

  const states = Array.isArray(input.states) ? input.states : [];
  out.states = states
    .map(s => {
      const name = String(s?.name || "").trim();
      const citiesIn = Array.isArray(s?.cities) ? s.cities : [];
      const cities = citiesIn
        .map(c => ({
          name: String(c?.name || "").trim(),
          fee: Math.round(Number(c?.fee))
        }))
        .filter(c => c.name && Number.isFinite(c.fee) && c.fee >= 0);
      return { name, cities };
    })
    .filter(s => s.name);

  out.states.sort((a, b) => a.name.localeCompare(b.name));
  out.states.forEach(s => s.cities.sort((a, b) => a.name.localeCompare(b.name)));
  return out;
}

/* ===================== ORDERS ===================== */
app.post("/orders", (req, res) => {
  try {
    const orders = readJson(ordersFile, []);
    const payload = req.body || {};

    const createdAt = payload.createdAt || payload.created_at || new Date().toISOString();
    const status = String(payload.status || "Pending");

    const newOrder = {
      id: Date.now(),
      reference: payload.reference || payload.paystack_ref || payload.id || `ORDER_${Date.now()}`,
      createdAt,
      status,
      ...payload
    };

    orders.push(newOrder);
    writeJsonAtomic(ordersFile, orders);

    res.json({ success: true, order: newOrder });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to save order" });
  }
});
app.post("/order", (req, res) => { req.url = "/orders"; app._router.handle(req, res); });

app.get("/orders", requireAdmin, (req, res) => {
  try {
    const orders = readJson(ordersFile, []);
    const status = String(req.query.status || "").trim();
    const q = String(req.query.q || "").trim().toLowerCase();

    let out = Array.isArray(orders) ? orders : [];
    if (status) out = out.filter(o => String(o.status || "") === status);

    if (q) {
      out = out.filter(o => {
        const ref = String(o.reference || o.id || "").toLowerCase();
        const name = String(o.name || o.customer?.name || "").toLowerCase();
        const phone = String(o.phone || o.customer?.phone || "").toLowerCase();
        const email = String(o.email || o.customer?.email || "").toLowerCase();
        return ref.includes(q) || name.includes(q) || phone.includes(q) || email.includes(q);
      });
    }

    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});
app.patch("/orders/:id/status", requireAdmin, (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const status = String(req.body?.status || "").trim();

    if (!Number.isFinite(orderId) || orderId <= 0 || !status) {
      return res.status(400).json({ success: false, message: "Missing orderId or status" });
    }

    const orders = readJson(ordersFile, []);
    const idx = orders.findIndex(o => Number(o.id) === orderId);
    if (idx === -1) return res.status(404).json({ success: false, message: "Order not found" });

    orders[idx].status = status;
    writeJsonAtomic(ordersFile, orders);

    res.json({ success: true, order: orders[idx] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to update status" });
  }
});

/* ===================== CONTACT (EMAIL + SAVE) ===================== */
const GMAIL_USER = process.env.GMAIL_USER || "";
const GMAIL_APP_PASS = process.env.GMAIL_APP_PASS || "";
const transporter = (GMAIL_USER && GMAIL_APP_PASS)
  ? nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASS }
    })
  : null;

app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, msg: "All fields required" });
    }

    const messages = readJson(messagesFile, []);
    const newMsg = { id: Date.now(), name, email, message, date: new Date().toISOString() };
    messages.push(newMsg);
    writeJsonAtomic(messagesFile, messages);

    if (transporter) {
      await transporter.sendMail({
        from: GMAIL_USER,
        replyTo: email,
        to: GMAIL_USER,
        subject: `New Contact from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
      });
    }

    res.json({ success: true, msg: "Message received — we will reply soon!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
});

/* ===================== MESSAGES (ADMIN) ===================== */
app.get("/admin/messages", requireAdmin, (req, res) => {
  const messages = readJson(messagesFile, []);
  res.json(Array.isArray(messages) ? messages : []);
});
app.delete("/admin/messages/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }
  const messages = readJson(messagesFile, []);
  const before = messages.length;
  const next = messages.filter(m => Number(m.id) !== id);

  if (next.length === before) {
    return res.status(404).json({ success: false, message: "Message not found" });
  }

  writeJsonAtomic(messagesFile, next);
  res.json({ success: true });
});

/* ===================== PRODUCTS + UPLOADS (MULTER) ===================== */

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const safeBase = path
      .basename(file.originalname || "file", ext)
      .replace(/[^a-z0-9_-]/gi, "_")
      .slice(0, 40);

    cb(null, `${Date.now()}_${safeBase}${ext || ".jpg"}`);
  }
});

// Accept only images
function imageOnly(req, file, cb) {
  const ok = /^image\//.test(file.mimetype || "");
  cb(ok ? null : new Error("Only image files allowed"), ok);
}

const upload = multer({
  storage,
  fileFilter: imageOnly,
  limits: { fileSize: 8 * 1024 * 1024 } // 8MB
});

// Public: get products
app.get("/api/products", (req, res) => {
  const list = readJson(productsFile, []);
  res.json(Array.isArray(list) ? list : []);
});

/* ===================== NIGERIA DEFAULT PRICING (SEED) ===================== */
function buildDefaultNigeriaPricing(fee = 5000) {
  const FEE = Math.max(0, Math.round(Number(fee) || 0));
  const statesAndCapitals = [
    { name: "Abia", city: "Umuahia" },
    { name: "Adamawa", city: "Yola" },
    { name: "Akwa Ibom", city: "Uyo" },
    { name: "Anambra", city: "Awka" },
    { name: "Bauchi", city: "Bauchi" },
    { name: "Bayelsa", city: "Yenagoa" },
    { name: "Benue", city: "Makurdi" },
    { name: "Borno", city: "Maiduguri" },
    { name: "Cross River", city: "Calabar" },
    { name: "Delta", city: "Asaba" },
    { name: "Ebonyi", city: "Abakaliki" },
    { name: "Edo", city: "Benin City" },
    { name: "Ekiti", city: "Ado-Ekiti" },
    { name: "Enugu", city: "Enugu" },
    { name: "FCT", city: "Abuja" },
    { name: "Gombe", city: "Gombe" },
    { name: "Imo", city: "Owerri" },
    { name: "Jigawa", city: "Dutse" },
    { name: "Kaduna", city: "Kaduna" },
    { name: "Kano", city: "Kano" },
    { name: "Katsina", city: "Katsina" },
    { name: "Kebbi", city: "Birnin Kebbi" },
    { name: "Kogi", city: "Lokoja" },
    { name: "Kwara", city: "Ilorin" },
    { name: "Lagos", city: "Ikeja" },
    { name: "Nasarawa", city: "Lafia" },
    { name: "Niger", city: "Minna" },
    { name: "Ogun", city: "Abeokuta" },
    { name: "Ondo", city: "Akure" },
    { name: "Osun", city: "Osogbo" },
    { name: "Oyo", city: "Ibadan" },
    { name: "Plateau", city: "Jos" },
    { name: "Rivers", city: "Port Harcourt" },
    { name: "Sokoto", city: "Sokoto" },
    { name: "Taraba", city: "Jalingo" },
    { name: "Yobe", city: "Damaturu" },
    { name: "Zamfara", city: "Gusau" }
  ];
  return {
    defaultFee: FEE,
    updatedAt: new Date().toISOString(),
    states: statesAndCapitals
      .map(s => ({ name: s.name, cities: [{ name: s.city, fee: FEE }] }))
      .sort((a, b) => a.name.localeCompare(b.name))
  };
}

/* ===================== START SERVER ===================== */
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
