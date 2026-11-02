// Folder: api/favorites.js
const { guard, robloxGet } = require("./_lib");

module.exports = async (req, res) => {
  const g = guard(req, res);
  if (!g) return;
  try {
    let url = `https://catalog.roblox.com/v1/favorites/users/${g.userId}/favorites/${g.typeId}/assets?limit=25&sortOrder=Desc`;
    if (g.cursor) url += `&cursor=${encodeURIComponent(g.cursor)}`;

    const r = await robloxGet(url);
    if (g.debug) return res.status(200).json({ status: r.status, raw: r.body });
    if (r.status === 401 || r.status === 403) return res.status(403).json({ error: "private" });
    if (r.status !== 200 || !r.body) return res.status(502).json({ error: "roblox_" + r.status });

    const rows = r.body.data || r.body.favorites || r.body.Data || [];
    const items = rows
      .map((x) => ({
        id: x.id || x.assetId || x.Id,
        name: x.name,
        price: x.price == null ? x.lowestPrice : x.price,
        typeId: x.assetType,
      }))
      .filter((x) => x.id);
    res.status(200).json({ items, nextCursor: r.body.nextPageCursor || r.body.nextCursor || "" });
  } catch (e) {
    res.status(504).json({ error: "timeout_or_network" });
  }
};
