// Folder: api/inventory.js
const { guard, robloxGet } = require("./_lib");

module.exports = async (req, res) => {
  const g = guard(req, res);
  if (!g) return;
  try {
    let url = `https://inventory.roblox.com/v2/users/${g.userId}/inventory/${g.typeId}?limit=50&sortOrder=Desc`;
    if (g.cursor) url += `&cursor=${encodeURIComponent(g.cursor)}`;

    const r = await robloxGet(url);
    if (g.debug) return res.status(200).json({ status: r.status, raw: r.body });
    if (r.status === 401 || r.status === 403) return res.status(403).json({ error: "private" });
    if (r.status !== 200 || !r.body) return res.status(502).json({ error: "roblox_" + r.status });

    const items = (r.body.data || []).map((x) => ({ id: x.assetId })).filter((x) => x.id);
    res.status(200).json({ items, nextCursor: r.body.nextPageCursor || "" });
  } catch (e) {
    res.status(504).json({ error: "timeout_or_network" });
  }
};
