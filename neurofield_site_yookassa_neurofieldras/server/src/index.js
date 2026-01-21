import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Database from "better-sqlite3";
import { nanoid } from "nanoid";
import ipaddr from "ipaddr.js";

dotenv.config();

const app = express();
app.set("trust proxy", true); // IMPORTANT if you are behind a reverse proxy (nginx, cloudflare)
app.use(cors());

// Need raw body for some providers; for YooKassa we can parse JSON safely.
app.use(express.json({ limit: "2mb" }));

const PORT = Number(process.env.PORT || 8787);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const PROVIDER = (process.env.PAYMENTS_PROVIDER || "mock").toLowerCase();

const db = new Database(new URL("../db/neurofield.sqlite", import.meta.url));
db.pragma("journal_mode = WAL");

const now = () => new Date().toISOString();
const token = () => nanoid(32);
const idempotenceKey = () => (globalThis.crypto?.randomUUID?.() || nanoid(24));

function createOrder({ type, stage, qty, email, telegram, amount, provider }) {
  const id = "ord_" + nanoid(10);
  const access_token = token();
  db.prepare(
    `INSERT INTO orders(id,type,stage,qty,amount,email,telegram,status,provider,created_at,access_token)
     VALUES (?,?,?,?,?,?,?,'created',?,?,?)`
  ).run(
    id,
    type,
    stage,
    qty,
    amount,
    email || null,
    telegram || null,
    provider || "mock",
    now(),
    access_token
  );
  return { id, access_token };
}

function updateOrderProviderPayment(order_id, provider_payment_id) {
  db.prepare(`UPDATE orders SET provider_payment_id=?, status='pending' WHERE id=?`).run(
    provider_payment_id,
    order_id
  );
}

function setOrderStatusByOrder(order_id, status) {
  db.prepare(`UPDATE orders SET status=? WHERE id=?`).run(status, order_id);
}

function setOrderStatusByProviderPayment(provider, provider_payment_id, status) {
  db.prepare(`UPDATE orders SET status=? WHERE provider=? AND provider_payment_id=?`).run(
    status,
    provider,
    provider_payment_id
  );
}

function getOrderById(order_id) {
  return db.prepare(`SELECT * FROM orders WHERE id=?`).get(order_id);
}

function getOrderByProviderPayment(provider, provider_payment_id) {
  return db.prepare(`SELECT * FROM orders WHERE provider=? AND provider_payment_id=?`).get(
    provider,
    provider_payment_id
  );
}

function safeJson(res, status, payload) {
  res.status(status).json(payload);
}

// ---------- YooKassa helpers ----------
const YK_SHOP_ID = process.env.YOOKASSA_SHOP_ID;
const YK_SECRET = process.env.YOOKASSA_SECRET_KEY;
const YK_RETURN_URL = process.env.YOOKASSA_RETURN_URL || `${BASE_URL}/payment-success.html`;

// YooKassa publishes a list of IPs/CIDRs for incoming notifications (can change; override via env if needed).
// Source: YooKassa docs "Входящие уведомления" IP list.
const defaultYkCidrs = [
  "185.71.76.0/27",
  "185.71.77.0/27",
  "77.75.153.0/25",
  "77.75.156.11",
  "77.75.156.35",
  "77.75.154.128/25",
  "2a02:5180::/32"
];

function parseCidrs(list) {
  return list
    .map((s) => s.trim())
    .filter(Boolean)
    .map((cidr) => {
      try {
        if (cidr.includes("/")) return ipaddr.parseCIDR(cidr);
        // single IP => convert to /32 or /128
        const ip = ipaddr.parse(cidr);
        return ip.kind() === "ipv6" ? [ip, 128] : [ip, 32];
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

const ykCidrs = parseCidrs(
  (process.env.YOOKASSA_ALLOWED_CIDRS || "").trim()
    ? process.env.YOOKASSA_ALLOWED_CIDRS.split(",")
    : defaultYkCidrs
);

function requestIp(req) {
  // express trust proxy will set req.ip based on X-Forwarded-For if present
  const ip = (req.ip || "").replace("::ffff:", "");
  return ip;
}

function ipAllowed(ip, cidrs) {
  if (!ip) return false;
  try {
    const addr = ipaddr.parse(ip);
    return cidrs.some(([net, prefix]) => addr.match(net, prefix));
  } catch {
    return false;
  }
}

function ykAuthHeader() {
  if (!YK_SHOP_ID || !YK_SECRET) return null;
  const token = Buffer.from(`${YK_SHOP_ID}:${YK_SECRET}`).toString("base64");
  return `Basic ${token}`;
}

async function ykCreatePayment({ order_id, amountRub, description }) {
  const auth = ykAuthHeader();
  if (!auth) throw new Error("Missing YooKassa credentials");

  const payload = {
    amount: { value: amountRub.toFixed(2), currency: "RUB" },
    capture: true,
    description,
    confirmation: { type: "redirect", return_url: YK_RETURN_URL },
    metadata: { order_id }
  };

  const resp = await fetch("https://api.yookassa.ru/v3/payments", {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      "Idempotence-Key": idempotenceKey()
    },
    body: JSON.stringify(payload)
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`YooKassa create payment failed: ${resp.status} ${JSON.stringify(data)}`);
  }
  return data; // contains confirmation.confirmation_url
}

async function ykGetPayment(payment_id) {
  const auth = ykAuthHeader();
  if (!auth) throw new Error("Missing YooKassa credentials");

  const resp = await fetch(`https://api.yookassa.ru/v3/payments/${payment_id}`, {
    headers: { Authorization: auth }
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`YooKassa get payment failed: ${resp.status} ${JSON.stringify(data)}`);
  }
  return data;
}

// ---------- Routes ----------

// Create payment intent (server-side price lookup by stage/type)
app.post("/api/payments/create", async (req, res) => {
  const { type, stage, qty, email, telegram } = req.body || {};
  if (type !== "stage" && type !== "visuals") return safeJson(res, 400, { error: "type must be stage|visuals" });

  const st = Math.max(1, Math.min(7, Number(stage || 1)));
  const q = Math.max(1, Math.min(5, Number(qty || 1)));
  const priceRub = 499;
  const amountRub = type === "visuals" ? priceRub * q : priceRub;

  const provider = PROVIDER;
  const { id: order_id, access_token } = createOrder({ type, stage: st, qty: q, email, telegram, amount: amountRub, provider });

  try {
    if (provider === "yookassa") {
      const yk = await ykCreatePayment({ order_id, amountRub, description: `NEUROFIELDRAS: заказ ${order_id}` });
      updateOrderProviderPayment(order_id, yk.id);
      // redirect flow: send user to confirmation_url (YooKassa)
      return safeJson(res, 200, {
        ok: true,
        order_id,
        amount: amountRub,
        currency: "RUB",
        checkout_url: yk.confirmation?.confirmation_url,
        access_token
      });
    }

    if (provider === "sber") {
      // TODO: implement Sber register.do + redirect formUrl + status check/callback.
      return safeJson(res, 501, { error: "Sber provider is not implemented in this demo build. Use YooKassa or mock." });
    }

    // mock
    const checkout_url = `${BASE_URL}/mock/checkout?order=${order_id}`;
    return safeJson(res, 200, { ok: true, order_id, amount: amountRub, currency: "RUB", checkout_url, access_token });
  } catch (e) {
    setOrderStatusByOrder(order_id, "failed");
    return safeJson(res, 500, { error: String(e?.message || e) });
  }
});

// Webhook endpoint (YooKassa -> Integration -> HTTP notifications)
app.post("/api/payments/webhook", async (req, res) => {
  const provider = PROVIDER;
  if (provider !== "yookassa") return safeJson(res, 200, { ok: true });

  // 1) Optional network validation (IP allowlist)
  const ip = requestIp(req);
  const allowed = ipAllowed(ip, ykCidrs);

  // If you can't rely on IP (CDN/proxy), keep it as a soft-check and still verify via API below.
  if (!allowed) {
    // do not reject hard by default; log and continue to API verification
    console.warn("Webhook IP not in allowlist:", ip);
  }

  // 2) Parse notification
  const body = req.body || {};
  const event = body.event;
  const object = body.object || {};
  const payment_id = object.id;

  if (!payment_id) return safeJson(res, 400, { error: "missing payment id" });

  // 3) Verify via YooKassa API (strongest validation)
  try {
    const payment = await ykGetPayment(payment_id);
    const order_id = payment?.metadata?.order_id;

    if (!order_id) return safeJson(res, 400, { error: "missing order_id in payment metadata" });

    const order = getOrderById(order_id);
    if (!order) return safeJson(res, 404, { error: "order not found" });

    // Cross-check amount
    const paidAmount = Number(payment?.amount?.value || 0);
    if (Number.isFinite(paidAmount) && Math.abs(paidAmount - Number(order.amount)) > 0.001) {
      return safeJson(res, 400, { error: "amount mismatch" });
    }

    // Update provider payment id if not stored (edge case)
    if (!order.provider_payment_id) updateOrderProviderPayment(order_id, payment_id);

    // Idempotency: if already paid, ack.
    if (order.status === "paid") return safeJson(res, 200, { ok: true });

    // Decide status
    // Typical final statuses: succeeded / canceled. Also possible waiting_for_capture if capture=false.
    const status = payment.status;
    const paid = !!payment.paid;

    if (event === "payment.succeeded" || (status === "succeeded" && paid)) {
      setOrderStatusByOrder(order_id, "paid");
      return safeJson(res, 200, { ok: true });
    }

    if (event === "payment.canceled" || status === "canceled") {
      setOrderStatusByOrder(order_id, "failed");
      return safeJson(res, 200, { ok: true });
    }

    // For other events keep pending
    setOrderStatusByOrder(order_id, "pending");
    return safeJson(res, 200, { ok: true });
  } catch (e) {
    console.error("Webhook verification error:", e);
    // Respond 200 to avoid retries storm; you can switch to 500 if you want retries.
    return safeJson(res, 200, { ok: true });
  }
});

// Access delivery (unchanged)
app.get("/api/access/:token", (req, res) => {
  const row = db.prepare("SELECT * FROM orders WHERE access_token=?").get(req.params.token);
  if (!row) return safeJson(res, 404, { error: "not found" });
  if (row.status !== "paid") return safeJson(res, 402, { error: "payment required", status: row.status });

  return safeJson(res, 200, {
    ok: true,
    order_id: row.id,
    type: row.type,
    stage: row.stage,
    qty: row.qty,
    amount: row.amount,
    deliver:
      row.type === "stage"
        ? [{ title: `Материалы по стадии ${row.stage}`, url: `${BASE_URL}/static/materials/stage-${row.stage}.pdf` }]
        : [{ title: `Картинки по стадии ${row.stage} (заявка)`, url: `${BASE_URL}/static/visuals/order-${row.id}.zip` }]
  });
});

// ---------- Mock checkout (kept for dev) ----------
app.get("/mock/checkout", (req, res) => {
  const order = req.query.order;
  const row = db.prepare("SELECT * FROM orders WHERE id=?").get(order);
  if (!row) return res.status(404).send("order not found");
  res.type("html").send(`<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
  <title>Mock checkout</title>
  <style>body{font-family:system-ui;max-width:720px;margin:0 auto;padding:24px} .box{border:1px solid #ddd;border-radius:12px;padding:16px}
  button{padding:12px 14px;border-radius:12px;border:1px solid #333;background:#111;color:#fff;cursor:pointer}</style>
  <h1>Mock checkout</h1>
  <div class=box>
    <div><b>Заказ:</b> ${row.id}</div>
    <div><b>Сумма:</b> ${row.amount} ₽</div>
    <p style="color:#666">Демо. Для реального платежа включите PAYMENTS_PROVIDER=yookassa и заполните ключи.</p>
    <button onclick="location.href='/api/payments/mock/succeed?order=${row.id}'">Оплатить (успех)</button>
    <button style="margin-left:8px;background:#fff;color:#111" onclick="location.href='/api/payments/mock/fail?order=${row.id}'">Оплатить (ошибка)</button>
  </div>`);
});

app.get("/api/payments/mock/succeed", (req, res) => {
  const order = req.query.order;
  const row = db.prepare("SELECT * FROM orders WHERE id=?").get(order);
  if (!row) return res.status(404).send("order not found");
  db.prepare("UPDATE orders SET status='paid' WHERE id=?").run(order);
  const access = `${BASE_URL}/api/access/${row.access_token}`;
  res.redirect(`${BASE_URL}/payment-success.html?order=${order}&access=${encodeURIComponent(access)}`);
});

app.get("/api/payments/mock/fail", (req, res) => {
  const order = req.query.order;
  const row = db.prepare("SELECT * FROM orders WHERE id=?").get(order);
  if (!row) return res.status(404).send("order not found");
  db.prepare("UPDATE orders SET status='failed' WHERE id=?").run(order);
  res.redirect(`${BASE_URL}/payment-error.html?order=${order}`);
});

app.listen(PORT, () => console.log("Server:", BASE_URL, "provider:", PROVIDER));
