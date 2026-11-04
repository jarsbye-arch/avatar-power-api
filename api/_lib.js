// Folder: api/_lib.js  (helper bersama, tidak jadi endpoint)
const cache = new Map();
const hits = new Map();

function guard(req, res) {
  const key = req.headers["x-app-key"] || req.query.key; // ?key= hanya untuk tes di browser HP
  if (!process.env.APP_KEY || key !== process.env.APP_KEY) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
  const userId = String(req.query.userId || "");
  const typeId = String(req.query.assetTypeId || "");
  const cursor = String(req.query.cursor || "");
  if (!/^\d{1,12}$/.test(userId) || !/^\d{1,3}$/.test(typeId) || cursor.length > 600) {
    res.status(400).json({ error: "bad_input" });
    return null;
  }
  // rate limit: 100 request / 10 detik per userId (dinaikkan dari 20 supaya "ambil semua kategori" muat)
  const now = Date.now();
  if (hits.size > 5000) hits.clear();
  const arr = (hits.get(userId) || []).filter((t) => now - t < 10000);
  if (arr.length >= 100) {
    res.status(429).json({ error: "rate_limited" });
    return null;
  }
  arr.push(now);
  hits.set(userId, arr);
  return { userId, typeId, cursor, debug: req.query.debug === "1" };
}

async function robloxGet(url, ttlMs = 3000) { // cache singkat supaya favorit baru cepat terlihat
  const c = cache.get(url);
  if (c && Date.now() - c.t < ttlMs) return c.v;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    let body = null;
    try { body = await r.json(); } catch (e) {}
    const v = { status: r.status, body };
    if (r.ok) {
      if (cache.size > 500) cache.clear();
      cache.set(url, { t: Date.now(), v });
    }
    return v;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { guard, robloxGet };
