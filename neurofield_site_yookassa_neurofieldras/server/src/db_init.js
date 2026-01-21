import Database from "better-sqlite3";
import fs from "node:fs"; import path from "node:path";

const dbPath = path.resolve("./db/neurofield.sqlite");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS orders(
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  stage INTEGER,
  qty INTEGER DEFAULT 1,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'RUB',
  email TEXT,
  telegram TEXT,
  status TEXT NOT NULL DEFAULT 'created',   -- created | pending | paid | failed | refunded
  provider TEXT,
  provider_payment_id TEXT,
  access_token TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_provider_payment ON orders(provider, provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_orders_access_token ON orders(access_token);
`);
console.log("DB initialized:", dbPath);
