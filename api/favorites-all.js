// Folder: api/favorites-all.js   (FILE BARU, taruh di folder api bersama favorites.js)
// Mengambil SEMUA favorit (semua kategori, semua halaman) dalam SATU permintaan, paralel di server Vercel.
// Dipanggil game dengan: /api/favorites-all?userId=123&assetTypeId=0  (assetTypeId=0 hanya pengisi supaya lolos guard)
const { guard, robloxGet } = require("./_lib");

const TYPES = [
  8, 41, 42, 43, 44, 45, 46, 47, 57, 58,
  2, 11, 12,
  64, 65, 66, 67, 68, 69, 70, 71, 72,
  76, 77, 17, 18, 79,
  27, 28, 29, 30, 31, 32,
  61, 78,
  48, 49, 50, 51, 52, 53, 54, 55, 56,
  24, 19,
];

const CONCURRENCY = 12;
const MAX_PAGES = 60;
const BUDGET_MS = 8000; // jaga di bawah batas waktu fungsi Vercel

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ambil satu URL, ulangi sebentar kalau Roblox menahan (429) atau error sementara
async function get(url) {
  let r;
  for (let i = 0; i < 3; i++) {
    r = await robloxGet(url, 20000);
    if (r.status !== 429 && r.status < 500) return r;
    await sleep(350 * (i + 1));
  }
  return r;
}

function favTime(x) {
  const raw = x.favoritedTime || x.favoriteTime || x.favoritedAt || x.favoriteDate || x.favoritedDate;
  if (raw == null) return undefined;
  const n = typeof raw === "number" ? raw : Date.parse(raw);
  return Number.isFinite(n) ? n : undefined;
}

async function fetchType(userId, t, deadline) {
  const items = [];
  let cursor = "";
  let limit = 100;
  for (let page = 0; page < MAX_PAGES; page++) {
    if (Date.now() > deadline) return { items, err: "deadline" };
    const build = (lim) => {
      let u = `https://catalog.roblox.com/v1/favorites/users/${userId}/favorites/${t}/assets?limit=${lim}&sortOrder=Desc`;
      if (cursor) u += `&cursor=${encodeURIComponent(cursor)}`;
      return u;
    };
    let r = await get(build(limit));
    if (r.status === 400 && limit === 100) { // limit 100 mungkin tidak didukung -> coba 25
      limit = 25;
      r = await get(build(limit));
    }
    if (r.status === 400 || r.status === 404) return { items, err: null }; // tipe tidak didukung = kosong
    if (r.status === 401 || r.status === 403) return { items, err: "private" };
    if (r.status !== 200 || !r.body) return { items, err: "roblox_" + r.status };

    const rows = r.body.data || r.body.favorites || r.body.Data || [];
    for (const x of rows) {
      const id = x.id || x.assetId || x.Id;
      if (!id) continue;
      items.push({
        id,
        name: x.name,
        price: x.price == null ? x.lowestPrice : x.price,
        typeId: t,
        rank: items.length, // 0 = terbaru di kategori ini (sortOrder=Desc)
        t: favTime(x),
      });
    }
    cursor = r.body.nextPageCursor || r.body.nextCursor || "";
    if (!cursor) break;
  }
  return { items, err: null };
}

module.exports = async (req, res) => {
  const g = guard(req, res);
  if (!g) return;
  const deadline = Date.now() + BUDGET_MS;
  const results = new Array(TYPES.length);
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= TYPES.length) return;
      try {
        results[i] = await fetchType(g.userId, TYPES[i], deadline);
      } catch (e) {
        results[i] = { items: [], err: "timeout_or_network" };
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const items = [];
  const failed = [];
  let priv = false;
  results.forEach((r, i) => {
    if (!r) { failed.push(TYPES[i]); return; }
    if (r.err === "private") priv = true;
    else if (r.err) failed.push(TYPES[i]);
    for (const it of r.items) items.push(it);
  });
  if (priv && items.length === 0) return res.status(403).json({ error: "private" });
  res.status(200).json({ items, failed });
};
