/* The screens. Each view is a function returning HTML for #main; render() draws the current
 * route. Inputs carry data-f="path.in.record" and save as you type without redrawing (only the
 * computed figures refresh); buttons carry data-act and redraw, keeping the scroll position. */
"use strict";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v) => (v === "" || v == null || isNaN(v)) ? null : Number(v);
const has = (v) => v !== null && v !== undefined && v !== "" && !isNaN(v);
const fmt = (n, d = 1) => has(n) ? (Math.round(n * 10 ** d) / 10 ** d).toString() : "";
const money = (n) => has(n) ? `${SETTINGS.currency}${Number(n).toFixed(2)}` : "";

const TECHNIQUES = ["wheel", "hand", "coil", "slab", "pinch", "marbled"];
/* Glazed is the finished look, so it's the last stage. What's measured after the glaze firing
 * still lives in p.final, it's just shown on the Glazed tab. */
const STAGES = ["wet", "bisque", "glazed"];
const METHODS = ["dip", "spray", "brush"];
const OUTCOMES = ["success", "partial", "failed"];
const DEFECTS = ["crack", "warp", "crawl", "pinhole", "color", "other"];
const SALES = ["not", "for", "sold"];
const FTYPES = ["bisque", "glaze", "wood", "raku", "other"];
const DSTATUS = ["concept", "attempted", "completed"];
const UNITS = ["cm", "mm", "in"];
/* A piece's shape decides which measurements it asks for. Built-ins cover the usual pots;
 * anything else is a shape of your own with the measurements you name. */
const SHAPES = { box: ["l", "w", "h"], mug: ["dia", "h"], bowl: ["dia", "depth"], plate: ["dia", "h"], vase: ["dia", "mouth", "h"], irregular: ["long", "short", "h"] };
const shapeName = (k) => SHAPES[k] ? t("shape." + k) : (DB.shapes[k] ? DB.shapes[k].name : t("shape.box"));
function shapeFields(p) {
  const k = (p && p.shape) || "box";
  if (SHAPES[k]) return SHAPES[k].map((f) => ({ key: f, label: t("dim." + f) }));
  const c = DB.shapes[k];
  if (c && (c.fields || []).length) return c.fields.map((label, i) => ({ key: "c" + i, label }));
  return SHAPES.box.map((f) => ({ key: f, label: t("dim." + f) }));
}
/** A measurement, from the shape's map or from the old l/w/h fields of earlier pieces. */
function mget(o, k) {
  if (!o) return undefined;
  if (o.m && o.m[k] !== undefined) return o.m[k];
  return o[k];
}
const hasDims = (o, keys) => !!o && keys.some((f) => has(mget(o, f.key)));
/** Trimming is the true starting size, so shrinkage measures from there when it's been recorded. */
const startOf = (p, keys) => hasDims(p.trim, keys) ? p.trim : p.wet;

// ---------- helpers on records
function getPath(o, path) { return path.split(".").reduce((a, k) => (a == null ? undefined : a[k]), o); }
function setPath(o, path, v) {
  const ks = path.split(".");
  let cur = o;
  ks.slice(0, -1).forEach((k, i) => { if (cur[k] == null || typeof cur[k] !== "object") cur[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; cur = cur[k]; });
  cur[ks[ks.length - 1]] = v;
}
function stageOf(p) {
  const any = (o, ks) => o && ks.some((k) => { const v = o[k]; return Array.isArray(v) ? v.length : has(v) || (typeof v === "string" && v); });
  let i = 0;
  const keys = shapeFields(p);
  if (hasDims(p.bisque, keys) || any(p.bisque, ["weight", "firingId"]) || hasHandle(p.bisque)) i = 1;
  if (any(p.glaze, ["glazes", "method", "firingId", "grams"])) i = 2;
  if (hasDims(p.final, keys) || any(p.final, ["weight", "outcome"]) || hasHandle(p.final)) i = 2;
  for (const ph of p.photos || []) i = Math.max(i, STAGES.indexOf(ph.stage === "final" ? "glazed" : ph.stage));
  for (const tr of Object.values(DB.trips)) for (const x of tr.items || []) {   // back from a bisque firing, or sent for a glaze one
    if (x.pieceId !== p.id) continue;
    if (tr.kind === "collect") i = Math.max(i, x.firing === "glaze" ? 2 : 1);
    else if (x.firing === "glaze") i = Math.max(i, 1);
  }
  return STAGES[i];
}
function shrink(from, to, keys) {
  if (!from || !to) return null;
  const out = { keys: [] }, vals = [];
  for (const f of (keys || [{ key: "l", label: "L" }, { key: "w", label: "W" }, { key: "h", label: "H" }])) {
    const a = mget(from, f.key), b = mget(to, f.key);
    if (has(a) && has(b) && a > 0) { out[f.key] = (a - b) / a * 100; out.keys.push(f); vals.push(out[f.key]); }
  }
  if (!vals.length) return null;
  out.avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return out;
}
function calc(p) {
  const total = (p.clay || []).reduce((a, r) => a + (has(r.g) ? Number(r.g) : 0), 0);
  const w = p.wet || {}, keys = shapeFields(p), from = startOf(p, keys);
  const cost = pieceCost(p);
  return {
    total: total ? `${fmt(total, 0)} g` : "–",
    trimmed: has(w.weight) && has(trimWeight(p)) ? `${fmt(w.weight - trimWeight(p), 0)} g (${fmt((w.weight - trimWeight(p)) / w.weight * 100)}%)` : "–",
    shrinkB: shrinkText(shrink(from, p.bisque, keys)),
    shrinkF: shrinkText(shrink(from, p.final, keys)),
    shrinkBavg: avgText(shrink(from, p.bisque, keys)),
    shrinkFavg: avgText(shrink(from, p.final, keys)),
    shrinkHB: shrinkText(shrink(handleOf(p.wet), handleOf(p.bisque))),
    shrinkHF: shrinkText(shrink(handleOf(p.wet), handleOf(p.final))),
    ...glazeFigures(p),
    lossB: lossText(p, p.bisque),
    lossF: lossText(p, p.final),
    expect: expectText(p, keys),
    costTotal: cost.total ? money(cost.total) : "–",
    stage: t("stage." + stageOf(p))
  };
}
function glazeFigures(p) {
  const gc = glazeCalc(p), nz = (v, f) => v == null ? "–" : f(v);
  const src = gc.size ? t("glz.from." + gc.size.stage, { dims: gc.size.dims }) : t("glz.noSize");
  return {
    gArea: nz(gc.areaEst, (v) => fmt(v, 0)),
    gMl: nz(gc.mlEst, (v) => fmt(v, 0)),
    gPerL: nz(gc.rateEst, (v) => (v * 1000).toFixed(2)),
    gCost: nz(gc.costEst, (v) => v.toFixed(2)),
    gTotal: gc.cost == null ? "–" : money(gc.cost),
    gNote: src
  };
}
/** Weight lost since the piece was made: from the trimmed weight when there is one, else as thrown. */
function lossText(p, o) {
  const a = has(trimWeight(p)) ? Number(trimWeight(p)) : n0((p.wet || {}).weight), b = o && o.weight;
  if (!a || !has(b)) return "–";
  return `${fmt(a - b, 0)} g (${fmt((a - b) / a * 100)}%)`;
}
/* What this piece should measure once finished, from the shrinkage of earlier pieces of the same
 * shape (the same clay when there are some, since clays shrink differently). */
function expectFor(p, keys) {
  const start = startOf(p, keys);
  if (!hasDims(start, keys)) return null;
  const main = (p.clay || []).filter((r) => r.type).sort((a, b) => n0(b.g) - n0(a.g))[0];
  const shape = p.shape || "box";
  const past = Object.values(DB.pieces).filter((q) => q.id !== p.id && (q.shape || "box") === shape && hasDims(q.final, keys));
  const same = main ? past.filter((q) => (q.clay || []).some((r) => r.type === main.type)) : [];
  const from = same.length ? same : past;
  const out = { n: from.length, keys: [] };
  for (const f of keys) {
    const s = from.map((q) => shrink(startOf(q, keys), q.final, keys)).filter((x) => x && has(x[f.key])).map((x) => x[f.key]);
    const a = mget(start, f.key);
    if (!s.length || !has(a)) continue;
    out[f.key] = a * (1 - s.reduce((x, y) => x + y, 0) / s.length / 100);
    out.keys.push(f);
  }
  return out.keys.length ? out : null;
}
function expectText(p, keys) {
  const e = expectFor(p, keys);
  if (!e) return "–";
  return `${e.keys.map((f) => `${f.label} ${fmt(e[f.key])}`).join(" · ")} ${p.unit || SETTINGS.unit} · ${t("expect.count", { n: e.n })}`;
}
/** The glaze cost on the Glazed tab. Empty boxes show the estimate; typing in one uses your number instead. */
function glazeBlock(p, c) {
  const g = p.glaze || {};
  const ph = (key, path, val) => numIn(path, val, c[key] === "–" ? "" : c[key]).replace("<input ", `<input data-calc-ph="${key}" `);
  return `<div class="sub glz"><div class="sub-body">
    <div class="glz-head"><b>${t("glz.title")}</b><b data-calc="gTotal">${esc(c.gTotal)}</b></div>
    <p class="meta" data-calc="gNote">${esc(c.gNote)}</p>
    <div class="grid2">${field(t("glz.area"), ph("gArea", "glaze.area", g.area))}${field(t("glz.coats"), numIn("glaze.coats", g.coats, String(GLAZE_COATS)))}</div>
    <div class="grid2">${field(t("cost.glazeUsed"), ph("gMl", "glaze.grams", g.grams))}${field(`${t("glz.perL")} (${esc(SETTINGS.currency)})`, ph("gPerL", "glaze.perL", g.perL))}</div>
    ${field(`${t("glz.cost")} (${esc(SETTINGS.currency)})`, ph("gCost", "glaze.cost", g.cost))}
    ${field(t("glz.coverage"), `<input type="number" inputmode="decimal" step="any" data-setting="glazeCoverage" value="${esc(coverage())}">`)}
    <p class="meta">${t("glz.hint")}</p>
  </div></div>`;
}
/** Where this piece went for this firing: dropped off, collected or still at the studio. */
function tripHistory(p, type) {
  const h = pieceTrips(p, type);
  if (!h.length) return "";
  return `<div class="hist">${h.map((x) => `<div class="hist-row">
    <a href="#/trip/${esc(x.drop.id)}">${esc(t("hist.dropped", { date: dateText(x.drop.date) }))}${x.drop.studio ? " · " + esc(label("studio", x.drop.studio)) : ""}${x.cone ? " · " + esc(x.cone) : ""}</a>
    ${x.back ? `<a href="#/trip/${esc(x.back.id)}">${esc(t("hist.collected", { date: dateText(x.back.date) }))}</a>` : `<i>${t("hist.waiting")}</i>`}</div>`).join("")}</div>`;
}
/** A computed figure that stays in the page and shows itself as soon as there's something to show. */
function calcRow(key, lbl, c) {
  return `<div class="calc"${c[key] === "–" ? " hidden" : ""}><span>${esc(lbl)}</span><b data-calc="${key}">${esc(c[key])}</b></div>`;
}

/* ---------- what a piece cost to make
 * Materials are priced from what you actually paid: every purchase of a clay or glaze adds to
 * its total grams and total cost, and the piece is charged the average rate for what it used.
 * A firing's fee and travel are shared equally between the pieces in that firing. */
/* One order can carry several bags and one delivery fee. The fee is spread over the
 * things on that order in proportion to what they cost, so a heavy cheap bag doesn't
 * carry the whole postage. */
function orderLines(b) {
  const items = (b.items || []).filter((x) => x && (has(x.grams) || has(x.cost)));
  const priced = items.filter((x) => has(x.cost));
  const goods = priced.reduce((a, x) => a + Number(x.cost), 0);
  const fee = has(b.delivery) ? Number(b.delivery) : 0;
  return items.map((x) => {
    const cost = has(x.cost) ? Number(x.cost) : 0;
    const share = !fee ? 0 : goods > 0 ? fee * (cost / goods) : fee / items.length;
    return { kind: x.kind || "clay", name: x.name, grams: has(x.grams) ? Number(x.grams) : 0, cost, share, total: cost + share };
  });
}
/** How a rate per gram (clay) or per ml (glaze) is shown: per kg, or per litre. */
const rateText = (kind, perUnit) => `${money(perUnit * 1000)} ${t(kind === "glaze" ? "unit.perL" : "unit.perKg")}`;
const amountText = (kind, n) => kind === "glaze" ? `${fmt(n, 0)} ml` : `${fmt(n / 1000, 2)} kg`;
/** Every order line that makes up a material's rate. */
function rateSources(kind, name) {
  const out = [];
  for (const b of Object.values(DB.purchases).sort((a, c) => (a.date || "").localeCompare(c.date || ""))) {
    for (const l of orderLines(b)) if (l.kind === kind && l.name === name && l.grams) out.push({ b, l });
  }
  return out;
}
/** The most recent order, at one shop if given. */
function lastOrder(store, except) {
  return Object.values(DB.purchases).filter((b) => b.id !== except && (!store || b.store === store) && (b.items || []).some((x) => x && (x.name || has(x.grams) || has(x.cost))))
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.createdAt - a.createdAt)[0] || null;
}
function orderCopy(b) {
  const items = (b.items || []).filter((x) => x && (x.name || has(x.grams) || has(x.cost))).map((x) => ({ kind: x.kind || "clay", name: x.name || "", grams: x.grams, cost: x.cost }));
  return { store: b.store || null, delivery: b.delivery, items, copiedFrom: b.id };
}
/** Still exactly the copy it started as, so switching shop can swap it for that shop's order. */
function orderCopied(rec) {
  const src = rec.copiedFrom && DB.purchases[rec.copiedFrom];
  return !!src && JSON.stringify(orderCopy(src).items) === JSON.stringify(orderCopy(rec).items);
}
const orderTotal = (b) => orderLines(b).reduce((a, l) => a + l.cost, 0) + (has(b.delivery) ? Number(b.delivery) : 0);
function rateFor(kind, name) {
  let g = 0, c = 0;
  for (const b of Object.values(DB.purchases)) {
    for (const l of orderLines(b)) {
      if (l.kind !== kind || l.name !== name || !l.grams) continue;
      g += l.grams; c += l.total;
    }
  }
  return g > 0 ? c / g : null;   // cost per gram including delivery, or null when nothing has been bought
}
/* A communal firing has two fares, one for the trip to drop pieces off and one for the trip to
 * collect them, both shared equally. The fee is either one total shared equally between the
 * pieces, or a price per kg charged on what each piece weighed going in. */
const n0 = (v) => has(v) ? Number(v) : 0;
const byWeight = (f) => f && f.split === "weight";
const faresOf = (f) => n0(f.travel) + n0(f.travelBack);
/** What a piece weighed going into this firing: trimmed (bone dry) for a bisque, bisque weight for a glaze. */
function firingWeight(p, fid) {
  const order = p.bisque && p.bisque.firingId === fid
    ? [trimWeight(p), (p.wet || {}).weight, (p.bisque || {}).weight]
    : [(p.bisque || {}).weight, (p.final || {}).weight, trimWeight(p), (p.wet || {}).weight];
  const w = order.find(has);
  return w == null ? null : Number(w);
}
function firingFee(f) {
  if (!byWeight(f)) return n0(f.fee);
  return piecesInFiring(f.id).reduce((a, p) => a + n0(f.perKg) * n0(firingWeight(p, f.id)) / 1000, 0);
}
const firingTotal = (f) => firingFee(f) + faresOf(f);
function firingShare(fid, p) {
  const f = DB.firings[fid];
  if (!f) return { fee: 0, travel: 0, n: 0 };
  const n = piecesInFiring(fid).length || 1;
  const w = p ? firingWeight(p, fid) : null;
  const fee = byWeight(f) ? n0(f.perKg) * n0(w) / 1000 : n0(f.fee) / n;
  return { fee, travel: faresOf(f) / n, n, w, weighed: !byWeight(f) || has(w) };
}
/* ---------- the studio: drop-offs and collections
 * A drop-off takes pieces for a bisque or a glaze firing (each group with its cone) and carries the
 * firing fee and the fare there. A collection brings pieces home, from any drop-offs, and carries
 * the fare back. A studio's prices are kept once, per kg, per piece or per cm of height, and fill
 * in the fee; typing what was actually paid shares that out instead. */
const TRIP_TYPES = ["bisque", "glaze"];
const PRICE_BY = ["kg", "piece", "cm"];
const tripsSorted = () => Object.values(DB.trips).sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.createdAt - a.createdAt);
const studioOf = (name) => name ? Object.values(DB.studios).find((x) => x.name === name) || null : null;
/** The price a studio charges for a type of firing, or null when it hasn't been set. */
function studioPrice(name, type) {
  const x = (studioOf(name) || {})[type];
  return x && has(x.price) ? { by: PRICE_BY.includes(x.by) ? x.by : "kg", price: Number(x.price) } : null;
}
/** What a piece weighed going in: bone dry (trimmed) for a bisque firing, its bisque weight for a glaze one. */
function weightFor(p, type) {
  const order = type === "bisque" ? [trimWeight(p), (p.wet || {}).weight, (p.bisque || {}).weight]
    : [(p.bisque || {}).weight, (p.final || {}).weight, trimWeight(p), (p.wet || {}).weight];
  const w = order.find(has);
  return w == null ? null : Number(w);
}
/** Its height going in, in cm, for studios that charge by height. */
function heightFor(p, type) {
  const unit = p.unit || SETTINGS.unit;
  const order = type === "bisque" ? [p.trim, p.wet, p.bisque] : [p.bisque, p.final, p.trim, p.wet];
  for (const o of order) { const h = mget(o, "h"); if (has(h)) return toCm(Number(h), unit); }
  return null;
}
const liveItems = (tr) => (tr.items || []).filter((x) => DB.pieces[x.pieceId]);
/** Everything dropped off and not collected yet, oldest first. */
function atStudio(studio) {
  const back = new Set();
  for (const tr of Object.values(DB.trips)) if (tr.kind === "collect") for (const x of tr.items || []) back.add(x.dropId + "|" + x.pieceId);
  const out = [];
  for (const tr of tripsSorted().reverse()) {
    if (tr.kind !== "drop" || (studio && tr.studio !== studio)) continue;
    for (const x of liveItems(tr)) if (!back.has(tr.id + "|" + x.pieceId)) out.push({ drop: tr, item: x, p: DB.pieces[x.pieceId] });
  }
  return out;
}
/** Each piece's line on a trip: what it measured, and its firing fee (drop-offs only). */
function tripFees(tr) {
  const rows = liveItems(tr).map((x) => {
    const p = DB.pieces[x.pieceId], type = x.firing === "glaze" ? "glaze" : "bisque";
    const pr = (tr.prices && tr.prices[type] && has(tr.prices[type].price)) ? { by: tr.prices[type].by, price: Number(tr.prices[type].price) } : studioPrice(tr.studio, type);
    const w = weightFor(p, type), h = heightFor(p, type);
    const base = !pr ? null : pr.by === "piece" ? pr.price : pr.by === "cm" ? (h == null ? null : pr.price * h) : (w == null ? null : pr.price * w / 1000);
    return { x, p, type, pr, w, h, base, fee: 0, how: "none" };
  });
  if (tr.kind !== "drop") return rows;
  if (has(tr.feePaid)) {   // what was actually paid, shared in proportion to the price list, else equally or by weight
    const parts = rows.length && rows.every((r) => r.base > 0) ? rows.map((r) => r.base) : tr.split === "weight" ? rows.map((r) => n0(r.w)) : rows.map(() => 1);
    const sum = parts.reduce((a, b) => a + b, 0);
    rows.forEach((r, i) => { r.fee = sum ? Number(tr.feePaid) * parts[i] / sum : 0; r.how = "share"; });
  } else rows.forEach((r) => { r.fee = n0(r.base); r.how = r.pr ? (r.base == null ? "missing" : r.pr.by) : "none"; });
  return rows;
}
const tripFeeTotal = (tr) => tripFees(tr).reduce((a, r) => a + r.fee, 0);
const tripsWith = (pid) => tripsSorted().filter((tr) => (tr.items || []).some((x) => x.pieceId === pid));
const tripName = (tr) => `${dateText(tr.date, true)} · ${t(tr.kind === "drop" ? "trip.drop" : "trip.collect")}${tr.studio ? " · " + label("studio", tr.studio) : ""}`;
/** The cones typed before, most used first, for one type of firing. */
function conesUsed(type) {
  const n = {};
  for (const tr of Object.values(DB.trips)) { const c = ((tr.cone || {})[type] || "").trim(); if (c) n[c] = (n[c] || 0) + 1; }
  for (const f of Object.values(DB.firings)) if ((f.type === "bisque") === (type === "bisque") && f.cone) n[f.cone] = (n[f.cone] || 0) + 1;
  return Object.keys(n).sort((a, b) => n[b] - n[a]);
}
/** Where a piece has been for one type of firing: dropped off, and collected or still there. */
function pieceTrips(p, type) {
  const out = [];
  for (const tr of tripsSorted().reverse()) {
    if (tr.kind !== "drop") continue;
    const x = (tr.items || []).find((i) => i.pieceId === p.id && (i.firing === "glaze" ? "glaze" : "bisque") === type);
    if (!x) continue;
    const back = Object.values(DB.trips).find((c) => c.kind === "collect" && (c.items || []).some((i) => i.dropId === tr.id && i.pieceId === p.id));
    out.push({ drop: tr, back, cone: (tr.cone || {})[type] });
  }
  return out;
}

/* Glaze is estimated from the piece's size: the surface inside and out, three coats on every
 * surface, at a set amount of glaze per coat. Every step can be typed over on the Glazed tab. */
const GLAZE_COATS = 3;
const coverage = () => has(SETTINGS.glazeCoverage) && Number(SETTINGS.glazeCoverage) > 0 ? Number(SETTINGS.glazeCoverage) : 2;   // ml per coat for each 100 cm²
const toCm = (v, unit) => unit === "mm" ? v / 10 : unit === "in" ? v * 2.54 : v;
/** Surface to glaze in cm², inside and outside, from the shape's measurements. Null for a shape of your own. */
function surfaceArea(shape, get) {
  const P = Math.PI, v = (k) => has(get(k)) ? Number(get(k)) : null;
  const d = v("dia"), h = v("h");
  switch (shape) {
    case "mug": return d && h ? 2 * (P * d * h + P * (d / 2) ** 2) : null;
    case "bowl": { const dp = v("depth"); return d && dp ? 2 * P * ((d / 2) ** 2 + dp ** 2) : null; }
    case "plate": return d ? 2 * P * (d / 2) ** 2 + P * d * (h || 0) : null;
    case "vase": return d && h ? 2 * P * d * h + P * (d / 2) ** 2 : null;
    case "box": case "irregular": {
      const l = v(shape === "box" ? "l" : "long"), w = v(shape === "box" ? "w" : "short");
      return l && w && h ? 2 * (2 * (l + w) * h + l * w) : null;
    }
  }
  return null;
}
/** Glaze goes on a bisqued piece, so its bisque size is the one to measure; else the nearest there is. */
function glazeSize(p) {
  const keys = shapeFields(p), unit = p.unit || SETTINGS.unit, shape = SHAPES[p.shape || "box"] ? (p.shape || "box") : null;
  for (const [stage, o] of [["bisque", p.bisque], ["glazed", p.final], ["trim", p.trim], ["wet", p.wet]]) {
    if (!shape || !hasDims(o, keys)) continue;
    const a = surfaceArea(shape, (k) => { const x = mget(o, k); return has(x) ? toCm(Number(x), unit) : null; });
    if (a) return { area: a, stage, dims: keys.filter((f) => has(mget(o, f.key))).map((f) => `${f.label} ${fmt(mget(o, f.key))}`).join(" × ") + " " + unit };
  }
  return null;
}
/** Price of glaze per ml: the glazes on this piece, else every glaze you've bought. */
function glazeRate(p) {
  const chosen = ((p.glaze || {}).glazes || []).map((x) => rateFor("glaze", x)).filter((x) => x != null);
  if (chosen.length) return { rate: chosen.reduce((a, b) => a + b, 0) / chosen.length, from: "chosen" };
  let ml = 0, c = 0;
  for (const b of Object.values(DB.purchases)) for (const l of orderLines(b)) if (l.kind === "glaze" && l.grams) { ml += l.grams; c += l.total; }
  return ml ? { rate: c / ml, from: "all" } : null;
}
const isGlazed = (p) => stageOf(p) === "glazed" || ((p.glaze || {}).glazes || []).length > 0 || !!(p.glaze || {}).firingId;
/** Every step of the glaze sum, each one either estimated or typed in. */
function glazeCalc(p) {
  const g = p.glaze || {}, size = glazeSize(p), r = glazeRate(p);
  const out = { active: isGlazed(p) || has(g.cost), size, coverage: coverage() };
  out.areaEst = size ? size.area : null;
  out.area = has(g.area) ? Number(g.area) : out.areaEst;
  out.coats = has(g.coats) ? Number(g.coats) : GLAZE_COATS;
  out.mlEst = out.area != null ? out.area / 100 * out.coats * out.coverage : null;
  out.ml = has(g.grams) ? Number(g.grams) : out.mlEst;          // "grams" holds the ml of glaze used
  out.rateEst = r ? r.rate : null; out.rateFrom = r ? r.from : null;
  out.rate = has(g.perL) ? Number(g.perL) / 1000 : out.rateEst;
  out.costEst = out.ml != null && out.rate != null ? out.ml * out.rate : null;
  out.cost = has(g.cost) ? Number(g.cost) : out.costEst;
  out.typed = { area: has(g.area), coats: has(g.coats), ml: has(g.grams), rate: has(g.perL), cost: has(g.cost) };
  return out;
}
/** Which weight clay is charged on: all the clay used, or only what's left after trimming (the trimmings get reclaimed). */
const clayBasis = () => SETTINGS.clayBasis === "trim" ? "trim" : "wet";
function pieceCost(p) {
  const out = { clay: 0, clayG: 0, clayBasis: clayBasis(), glaze: 0, firing: 0, travel: 0, other: 0, missing: [], clayLines: [], glazeLine: null, fires: [], trips: [] };
  const typed = (p.clay || []).filter((row) => row.type);
  const rowG = typed.reduce((a, row) => a + n0(row.g), 0);
  // the mix of clays, and how many grams of wet clay went in
  const mix = rowG > 0 ? typed.filter((row) => n0(row.g) > 0).map((row) => ({ type: row.type, share: n0(row.g) / rowG }))
    : typed.map((row) => ({ type: row.type, share: 1 / typed.length }));
  const wetG = rowG > 0 ? rowG : n0((p.wet || {}).weight);
  if (out.clayBasis === "trim" && !has(trimWeight(p))) out.clayBasis = "wet";   // not trimmed yet: fall back to the wet clay
  out.clayG = out.clayBasis === "trim" ? Number(trimWeight(p)) : wetG;
  out.wetG = wetG;
  if (!mix.length && out.clayG) out.missing.push(t("cost.noClayType"));
  for (const m of mix) {
    const r = rateFor("clay", m.type);
    if (r == null) { out.missing.push(label("clay", m.type)); continue; }
    out.clay += r * out.clayG * m.share;
    out.clayLines.push({ type: m.type, grams: out.clayG * m.share, rate: r, cost: r * out.clayG * m.share });
  }
  const gc = glazeCalc(p);
  if (gc.active) {
    if (gc.cost != null) { out.glaze = gc.cost; out.glazeLine = gc; }
    else out.missing.push(t(gc.ml == null ? "glz.needSize" : "glz.needPrice"));
  }
  for (const key of ["bisque", "glaze"]) {
    const fid = p[key] && p[key].firingId;
    if (!fid) continue;
    const sh = firingShare(fid, p);
    out.fires.push(Object.assign({ fid, f: DB.firings[fid] }, sh));
    out.firing += sh.fee; out.travel += sh.travel;
    if (!sh.weighed) out.missing.push(t("cost.noWeight"));
  }
  for (const tr of tripsWith(p.id)) {
    const rows = tripFees(tr), r = rows.find((x) => x.p.id === p.id);
    if (!r) continue;
    const fare = n0(tr.fare) / (rows.length || 1);
    out.firing += r.fee; out.travel += fare;
    out.trips.push({ tr, row: r, fare, n: rows.length });
    if (r.how === "missing") out.missing.push(t(r.pr.by === "cm" ? "trip.needHeight" : "cost.noWeight"));
    if (r.how === "none" && tr.kind === "drop") out.missing.push(t("trip.needPrice", { studio: tr.studio ? label("studio", tr.studio) : t("fire.studio") }));
  }
  if (has(p.otherCost)) out.other += Number(p.otherCost);
  out.total = out.clay + out.glaze + out.firing + out.travel + out.other;
  return out;
}
/** The weight after trimming, wherever it was recorded: the trim stage, or an older piece's wet stage. */
const trimWeight = (p) => has((p.trim || {}).weight) ? p.trim.weight : (p.wet || {}).trimmed;
const salePrice = (p) => { const s = p.sale || {}; return has(s.price) ? Number(s.price) : has(s.ask) ? Number(s.ask) : 0; };
const handleOf = (o) => (o && o.handle) || null;
const hasHandle = (o) => { const h = handleOf(o); return !!h && ["cut", "l", "w", "h"].some((k) => has(mget(h, k))); };
/** The optional handle block inside a stage: length as cut (wet only), then size once attached. */
function handleBlock(stage, o, unit, withCut, c) {
  const h = handleOf(o) || {};
  const open = hasHandle(o) || OPEN.has(stage + "-handle");
  return `<details class="sub" data-sec="${stage}-handle"${open ? " open" : ""}><summary>${t("f.handle")}</summary><div class="sub-body">
    ${withCut ? field(`${t("f.handleCut")} (${esc(unit)})`, numIn(`${stage}.handle.cut`, h.cut)) : ""}
    <span class="lbl">${t("f.handleDims")}</span>
    ${dims(`${stage}.handle`, h, unit, [{ key: "l", label: t("dim.l") }, { key: "w", label: t("dim.w") }, { key: "h", label: t("dim.h") }])}
    ${stage === "wet" ? "" : calcRow(stage === "bisque" ? "shrinkHB" : "shrinkHF", t(stage === "bisque" ? "f.shrinkHandleB" : "f.shrinkHandleF"), c)}
  </div></details>`;
}
function shrinkText(s) {
  if (!s) return "–";
  const parts = (s.keys || []).map((f) => `${f.label} ${fmt(s[f.key])}%`);
  return parts.length > 1 ? `${parts.join(" · ")} · ${t("avg")} ${fmt(s.avg)}%` : parts[0];
}
function avgText(s) { return s ? `${fmt(s.avg)}%` : "–"; }
function pieceName(p) {
  return p.title ? p.title : `${t("untitled")} · ${dateText(p.started)}`;
}
function dateText(d, withYear) {
  if (!d) return "";
  const dt = new Date(d + "T12:00:00");
  if (isNaN(dt)) return d;
  const opts = { day: "numeric", month: "short" };
  if (withYear || dt.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  return dt.toLocaleDateString(LANG === "zh" ? "zh-CN" : "en-GB", opts);
}
function ago(ts) {
  const m = Math.round((now() - ts) / 60000);
  if (m < 1) return t("just now");
  if (m < 60) return t("min ago", { n: m });
  if (m < 60 * 24) return t("h ago", { n: Math.round(m / 60) });
  return t("d ago", { n: Math.round(m / 1440) });
}
const sortedPieces = () => Object.values(DB.pieces).sort((a, b) => (b.started || "").localeCompare(a.started || "") || b.createdAt - a.createdAt);
const coverOf = (p) => (p.photos || []).find((x) => x.id === p.cover) || (p.photos || []).slice(-1)[0] || null;
const firingName = (f) => `${dateText(f.date, true)} · ${label("ftype", f.type)}${f.cone ? " · " + f.cone : ""}`;
function piecesInFiring(fid) { return sortedPieces().filter((p) => (p.bisque && p.bisque.firingId === fid) || (p.glaze && p.glaze.firingId === fid)); }

// ---------- small HTML builders
let PHOTO_INDEX = new Map();   // photo id -> photo object, rebuilt on each render for <img data-pid>
function img(p, cls = "", thumb = true) {
  if (!p) return `<div class="ph-empty ${cls}"></div>`;
  PHOTO_INDEX.set(p.id, p);
  return `<img class="${cls}" data-pid="${esc(p.id)}" ${thumb ? 'data-thumb="1"' : ""} alt="" loading="lazy">`;
}
function chips(group, values, selected, labelFn, opts = {}) {
  const sel = Array.isArray(selected) ? selected : (selected == null ? [] : [selected]);
  const from = opts.add ? ` data-from="${esc(opts.add)}"` : "";   // long-press one of these to take it off the list
  return `<div class="chips">${values.map((v) => `<button type="button" class="chip${opts.cls ? " " + opts.cls + "-" + esc(v) : ""}" data-act="chip" data-group="${esc(group)}" data-val="${esc(v)}"${opts.single ? " data-single" : ""}${from} aria-pressed="${sel.includes(v)}">${esc(labelFn(v))}</button>`).join("")}${opts.add ? `<button type="button" class="chip add" data-act="list-add" data-list="${opts.add}" data-group="${esc(group)}">+</button>` : ""}</div>`;
}
function field(lbl, inner, cls = "") { return `<label class="field ${cls}"><span>${esc(lbl)}</span>${inner}</label>`; }
function numIn(path, val, ph = "", scale) {
  const shown = has(val) ? (scale ? Math.round(val / scale * 1e6) / 1e6 : val) : "";
  return `<input type="number" inputmode="decimal" step="any" data-f="${path}" data-num${scale ? ` data-scale="${scale}"` : ""} value="${esc(shown)}" placeholder="${esc(ph)}">`;
}
function textIn(path, val, ph = "", list = "") { return `<input type="text" data-f="${path}" value="${esc(val || "")}" placeholder="${esc(ph)}"${list ? ` list="${list}"` : ""}>`; }
function dateIn(path, val) { return `<input type="date" data-f="${path}" value="${esc(val || "")}">`; }
function area(path, val, ph = "") { return `<textarea data-f="${path}" rows="3" placeholder="${esc(ph)}">${esc(val || "")}</textarea>`; }
function dims(prefix, o, unit, keys) {
  o = o || {};
  const fs = keys || [{ key: "l", label: t("dim.l") }, { key: "w", label: t("dim.w") }, { key: "h", label: t("dim.h") }];
  return `<div class="dims">${fs.map((f) => `<label><span>${esc(f.label)}</span>${numIn(`${prefix}.m.${f.key}`, mget(o, f.key), unit)}</label>`).join("")}</div>`;
}
function section(id, title, body, summary = "") {
  const open = OPEN.has(id);
  return `<details class="sec" data-sec="${id}"${open ? " open" : ""}><summary><span>${esc(title)}</span><em data-sum="${id}">${summary}</em></summary><div class="sec-body">${body}</div></details>`;
}
function firingSelect(path, current, type) {
  const fs = Object.values(DB.firings).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const pref = fs.filter((f) => (type === "bisque") === (f.type === "bisque"));
  const rest = fs.filter((f) => !pref.includes(f));
  const opt = (f) => `<option value="${esc(f.id)}"${f.id === current ? " selected" : ""}>${esc(firingName(f))}</option>`;
  return `<div class="row"><select data-f="${path}" data-firing-type="${type}"><option value="">${t("none")}</option>${pref.map(opt).join("")}${rest.map(opt).join("")}<option value="__new__">${t("newFiringOpt")}</option></select>${current && DB.firings[current] ? `<a class="btn small ghost" href="#/firing/${esc(current)}">›</a>` : ""}</div>`;
}
function uploadBtn(target, capture, text) {
  return `<label class="btn ${capture ? "primary" : ""}"><input type="file" accept="image/*" hidden data-upload="${target}"${capture ? ' capture="environment"' : " multiple"}>${capture ? ICON.camera : ICON.image} ${esc(text)}</label>`;
}
/** Wraps a row so it can be swiped aside to show Delete. */
function swipeable(inner, coll, id, hay) {
  return `<div class="swipe" data-coll="${esc(coll)}" data-id="${esc(id)}"${hay ? ` data-hay="${esc(hay)}"` : ""}>
    <button class="swipe-del" data-act="swipe-delete" data-coll="${esc(coll)}" data-id="${esc(id)}">${ICON.trash}<span>${t("btn.delete")}</span></button>
    ${inner}</div>`;
}
function empty(text) { return `<p class="empty">${esc(text)}</p>`; }

const ICON = {
  pieces: '<svg viewBox="0 0 24 24"><path d="M9 3h6M9.5 3l-.4 2.6a4 4 0 0 1-.9 2L7 9.4A6.5 6.5 0 0 0 5.6 13v4.5A3.5 3.5 0 0 0 9.1 21h5.8a3.5 3.5 0 0 0 3.5-3.5V13a6.5 6.5 0 0 0-1.4-3.6l-1.2-1.8a4 4 0 0 1-.9-2L14.5 3"/></svg>',
  costs: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6.5" rx="7" ry="2.8"/><path d="M5 6.5v5c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-5M5 11.5v5c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-5"/></svg>',
  gallery: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M3.5 17.5l4.7-4.2a2 2 0 0 1 2.7 0l3.3 3M14 15.2l1.9-1.6a2 2 0 0 1 2.6 0l2 1.7"/></svg>',
  firings: '<svg viewBox="0 0 24 24"><path d="M12 2.5c3.6 3.4 6.5 6.1 6.5 10.2a6.5 6.5 0 0 1-13 0c0-2.2 1-4 2.6-5.6-.2 1.8.4 3 1.6 3.4.7-3 .8-5.3 2.3-8z"/></svg>',
  more: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><path d="M4 7.5h4.5M13.5 7.5H20M4 16.5h6.5M15.5 16.5H20"/><circle cx="11" cy="7.5" r="2.4"/><circle cx="13" cy="16.5" r="2.4"/></svg>',
  ideas: '<svg viewBox="0 0 24 24"><path d="M9.5 18h5M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2h5c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M3.5 8.5h3.2l1.6-2.6h7.4l1.6 2.6h3.2v10.6H3.5z"/><circle cx="12" cy="13.6" r="3.4"/></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M3.5 17.5l4.7-4.2a2 2 0 0 1 2.7 0l3.3 3M14 15.2l1.9-1.6a2 2 0 0 1 2.6 0l2 1.7"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M4 6.5h16M4 12h16M4 17.5h16"/></svg>',
  grid: '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/></svg>',
  gridText: '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><path d="M3.5 14.5h7M3.5 18h5M13.5 14.5h7M13.5 18h5"/></svg>',
  text: '<svg viewBox="0 0 24 24"><path d="M4 6.5h16M4 12h11M4 17.5h7"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5.5v13M5.5 12h13"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5.5A1.5 1.5 0 0 1 11.5 4h1A1.5 1.5 0 0 1 14 5.5V7M6.5 7l.8 11.6A1.5 1.5 0 0 0 8.8 20h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7M10.5 10.5v6M13.5 10.5v6"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.6"/><path d="M19.5 19.5l-3.8-3.8"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="M9.5 5.5L16 12l-6.5 6.5"/></svg>',
  filter: '<svg viewBox="0 0 24 24"><path d="M4.5 6.5h15M7 12h10M10 17.5h4"/></svg>',
  swap: '<svg viewBox="0 0 24 24"><path d="M6 8.5h12l-3-3M18 15.5H6l3 3"/></svg>'
};

// ---------- routing
let ROUTE = { name: "pieces" };
let OPEN = new Set();            // which piece-editor sections are expanded
let OPEN_FOR = null;             // ...and for which piece
let PIECE_FILTER = "all";
let PIECE_TAG = null;             // a category tag to narrow the wall to
function parseRoute() {
  const [name, id] = location.hash.replace(/^#\/?/, "").split("/");
  return { name: name || "pieces", id: id ? decodeURIComponent(id) : null };
}
const go = (h) => { location.hash = h; };
window.addEventListener("hashchange", () => { ROUTE = parseRoute(); closeSheet(); render(); window.scrollTo(0, 0); });

const TABS = ["pieces", "firings", "ideas", "costs"];
const TAB_OF = { trip: "firings", studio: "firings", pcost: "costs", piece: "pieces", firing: "firings", design: "ideas", insp: "ideas", settings: "more", more: "pieces", purchase: "costs" };

// ---------- views
const VIEWS = {};

VIEWS.pieces = () => {
  const all = sortedPieces();
  const filters = ["all", ...STAGES, "for", "sold"];
  const tagsUsed = [...new Set(all.flatMap((p) => p.tags || []))];
  if (PIECE_TAG && !tagsUsed.includes(PIECE_TAG)) PIECE_TAG = null;
  const shown = all.filter((p) => PIECE_FILTER === "all" ? true : STAGES.includes(PIECE_FILTER) ? stageOf(p) === PIECE_FILTER : (p.sale && p.sale.status) === PIECE_FILTER)
    .filter((p) => !PIECE_TAG || (p.tags || []).includes(PIECE_TAG));
  const fl = (v) => v === "all" ? (LANG === "zh" ? "全部" : "All") : STAGES.includes(v) ? t("stage." + v) : t("sale." + v);
  const view = ["grid", "titles", "list"].includes(SETTINGS.pieceView) ? SETTINGS.pieceView : "grid";
  const grid = view !== "list";
  return `
    ${all.length ? `<div class="toolbar"><label class="search">${ICON.search}<input type="search" data-search placeholder="${t("search")}"></label>
      <div class="row between"><div class="wordtabs">${filters.map((v) => `<button data-act="piece-filter" data-val="${v}" aria-pressed="${PIECE_FILTER === v}">${esc(fl(v))}</button>`).join("")}</div>
      <button class="icon-btn" data-act="piece-view" aria-label="${t("f.layout")}" title="${t("f.layout")}">${{ grid: ICON.grid, titles: ICON.gridText, list: ICON.list }[view]}</button></div>
      ${tagsUsed.length ? `<div class="chips scroll tagfilter">${tagsUsed.map((v) => `<button type="button" class="chip" data-act="piece-tag" data-val="${esc(v)}" aria-pressed="${PIECE_TAG === v}">${esc(label("tag", v))}</button>`).join("")}</div>` : ""}</div>` : ""}
    ${grid
      ? `<div class="pgrid${view === "titles" ? " titled" : ""}">${shown.map(pieceTile).join("")}</div>${shown.length ? "" : empty(all.length ? t("empty.match") : t("empty.pieces"))}`
      : `<div class="cards">${shown.map(pieceCard).join("") || empty(all.length ? t("empty.match") : t("empty.pieces"))}</div>`}
    <div class="fab">${`<label class="fab-cam" aria-label="${t("btn.takePhoto")}"><input type="file" accept="image/*" capture="environment" hidden data-upload="newpiece">${ICON.camera}</label>`}
      <button class="btn primary" data-act="new-piece">${ICON.plus} ${t("btn.newPiece")}</button></div>`;
};
/** One photo in the wall, with the piece's name under it when titles are on. */
function pieceTile(p) {
  const st = stageOf(p), s = p.sale || {};
  const hay = [p.title, p.notes, ...(p.tags || []).map((x) => label("tag", x)), ...(p.technique || []).map((x) => label("tech", x))].join(" ").toLowerCase();
  return `<a class="ptile" href="#/piece/${esc(p.id)}" data-hay="${esc(hay)}" data-hold="pieces:${esc(p.id)}">
    <span class="shot">${img(coverOf(p))}<span class="pill st-${st}">${t("stage." + st)}</span>${s.status === "sold" ? `<i class="sold">${esc(money(salePrice(p)))}</i>` : ""}</span>
    ${SETTINGS.pieceView === "titles" ? `<span class="cap"><b>${esc(pieceName(p))}</b><i>${esc(dateText(p.started))}</i></span>` : ""}
  </a>`;
}
function pieceCard(p) {
  const st = stageOf(p), s = p.sale || {};
  const line = [t("stage." + st), s.status === "sold" ? `${t("sale.sold")}${has(s.price) || has(s.ask) ? " " + money(has(s.price) ? s.price : s.ask) : ""}`
    : s.status === "for" ? `${t("sale.for")}${has(s.ask) ? " " + money(s.ask) : ""}`
    : p.final && p.final.outcome && p.final.outcome !== "success" ? t("outcome." + p.final.outcome) : dateText(p.started)].filter(Boolean).join(" · ");
  const hay = [p.title, p.notes, ...(p.tags || []).map((x) => label("tag", x)), ...(p.technique || []).map((x) => label("tech", x)), ...((p.glaze && p.glaze.glazes) || [])].join(" ").toLowerCase();
  return swipeable(`<a class="card piece" href="#/piece/${esc(p.id)}">
    ${img(coverOf(p), "thumb")}
    <div class="card-body">
      <div class="card-title">${esc(pieceName(p))}</div>
      <div class="meta"><i class="dot st-${st}"></i>${esc(line)}</div>
    </div></a>`, "pieces", p.id, hay);
}

/* A piece is one stage at a time: the tabs across the top swap what's below them, so only
 * the handful of numbers that matter right now is on screen. */
const PIECE_TABS = ["wet", "bisque", "glaze", "design", "cost"];
let PIECE_TAB = null, PIECE_TAB_FOR = null;
const tabLabel = (k) => k === "glaze" ? t("stage.glazed") : k === "design" ? t("tab.design") : k === "cost" ? t("cost.title") : t("stage." + k);
/** Has anything been filled in for this tab yet? Marks the tab with a small dot. */
function tabFilled(p, k) {
  const any = (o, ks) => o && ks.some((x) => { const v = o[x]; return Array.isArray(v) ? v.length : (has(v) || (typeof v === "string" && v)); });
  const keys = shapeFields(p);
  if (k === "wet") return hasDims(p.wet, keys) || hasDims(p.trim, keys) || any(p.wet, ["weight", "dryDays", "dryNotes"]) || any(p.trim, ["weight"]) || hasHandle(p.wet) || (p.clay || []).length > 0 || (p.technique || []).length > 0;
  if (k === "bisque") return hasDims(p.bisque, keys) || any(p.bisque, ["weight", "firingId"]) || hasHandle(p.bisque);
  if (k === "glaze") return any(p.glaze, ["glazes", "method", "firingId", "grams"]) || hasDims(p.final, keys) || any(p.final, ["weight", "outcome"]) || hasHandle(p.final);
  if (k === "design") return !!p.designId || (p.inspIds || []).length > 0;
  return !!(p.sale && p.sale.status && p.sale.status !== "not") || pieceCost(p).total > 0;
}

VIEWS.piece = (r) => {
  const p = DB.pieces[r.id];
  if (!p) return null;
  const st = stageOf(p), u = p.unit || SETTINGS.unit, c = calc(p);
  if (PIECE_TAB_FOR !== p.id) { PIECE_TAB_FOR = p.id; PIECE_TAB = st === "glazed" ? "glaze" : st; }
  const tab = PIECE_TABS.includes(PIECE_TAB) ? PIECE_TAB : "wet";
  const addStage = r.addStage || st;
  const photos = p.photos || [];
  return `<div data-rec data-coll="pieces" data-id="${esc(p.id)}" class="editor">
    <div class="hero" data-act="${photos.length ? "photo" : ""}" data-pid="${esc((coverOf(p) || {}).id || "")}"${photos.length ? ` data-hold="photo:${esc(coverOf(p).id)}"` : ""}>${photos.length ? img(coverOf(p), "hero-img", false) : `<label class="hero-add"><input type="file" accept="image/*" capture="environment" hidden data-upload="piece">${ICON.camera}<span>${t("btn.takePhoto")}</span></label>`}</div>
    <input class="title-in" type="text" data-f="title" value="${esc(p.title || "")}" placeholder="${esc(t("untitled"))}">
    <div class="ptabs">${PIECE_TABS.map((k) => `<button data-act="piece-tab" data-val="${k}" aria-pressed="${k === tab}">${esc(tabLabel(k))}${tabFilled(p, k) ? `<i class="dot st-${k === "glaze" ? "glazed" : k}"></i>` : ""}</button>`).join("")}</div>
    <div class="tabbody">${TAB_BODY[tab](p, c, u)}</div>

    <div class="photos">
      <div class="ph-grid">${photos.map((ph) => `<button class="ph" data-act="photo" data-pid="${esc(ph.id)}" data-hold="photo:${esc(ph.id)}">${img(ph)}<span class="pill st-${ph.stage}">${t("stage." + ph.stage)}</span>${ph.id === p.cover ? '<i class="star">★</i>' : ""}${ph.url ? "" : '<i class="dot" title="not uploaded"></i>'}</button>`).join("")}
        <label class="ph add"><input type="file" accept="image/*" capture="environment" hidden data-upload="piece">${ICON.camera}</label>
        <label class="ph add"><input type="file" accept="image/*" multiple hidden data-upload="piece">${ICON.image}</label></div>
      <div class="ph-stage"><span>${t("f.addStage")}</span>${chips("addStage", STAGES, addStage, (v) => t("stage." + v), { single: true })}</div>
    </div>

    <button class="btn danger wide" data-act="delete" data-coll="pieces">${t("btn.delete")}</button>
  </div>`;
};

/** What each tab shows. Every field stays optional; nothing here is required to save. */
const TAB_BODY = {
  wet(p, c, u) {
    const w = p.wet || {}, tr = p.trim || {}, keys = shapeFields(p);
    const customShapes = Object.values(DB.shapes).sort((a, b) => a.createdAt - b.createdAt);
    const clayRows = (p.clay || []).map((row, i) => `<div class="clay-row">
      <select data-f="clay.${i}.type" data-list="clay"><option value="">${t("f.clayType")}</option>${[...new Set([...listValues("clay"), row.type].filter(Boolean))].map((v) => `<option value="${esc(v)}"${v === row.type ? " selected" : ""}>${esc(label("clay", v))}</option>`).join("")}<option value="__new__">+ …</option></select>
      <input type="number" inputmode="numeric" step="any" data-f="clay.${i}.g" data-num value="${has(row.g) ? esc(row.g) : ""}" placeholder="g">
      <button class="icon-btn" data-act="clay-del" data-i="${i}" aria-label="${t("btn.delete")}">${ICON.x}</button></div>`).join("");
    return `
      ${field(t("f.shape"), `<div class="chips">${[...Object.keys(SHAPES), ...customShapes.map((x) => x.id)].map((k) => `<button type="button" class="chip" data-act="shape" data-val="${esc(k)}" aria-pressed="${(p.shape || "box") === k}">${esc(shapeName(k))}</button>`).join("")}<button type="button" class="chip add" data-act="shape-new">+</button></div>`)}
      <div class="row between"><span class="lbl">${t("f.dimsThrown")}</span><select data-f="unit" class="unit">${UNITS.map((x) => `<option${x === u ? " selected" : ""}>${x}</option>`).join("")}</select></div>
      ${dims("wet", w, u, keys)}
      ${field(t("f.weightThrown"), numIn("wet.weight", w.weight))}
      <span class="lbl">${t("f.dimsTrimmed")}</span>
      ${dims("trim", tr, u, keys)}
      ${field(t("f.weightTrimmed"), numIn("trim.weight", has(tr.weight) ? tr.weight : (w.trimmed)))}
      ${calcRow("trimmed", t("f.trimmedOff"), c)}
      ${calcRow("expect", t("f.expect"), c)}
      ${handleBlock("wet", w, u, true, c)}
      <span class="lbl">${t("sec.clay")}</span>
      ${clayRows}
      <div class="row"><button class="btn small" data-act="clay-add">${ICON.plus} ${t("btn.addRow")}</button>${(p.clay || []).length ? `<span class="meta">${t("f.totalClay")} <b data-calc="total">${c.total}</b></span>` : ""}</div>
      ${field(t("f.technique"), chips("technique", TECHNIQUES, p.technique, (v) => t("tech." + v)))}
      ${field(t("f.tags"), chips("tags", [...new Set([...listValues("tags"), ...(p.tags || [])])], p.tags, (v) => label("tag", v), { add: "tags" }))}
      ${field(t("f.started"), dateIn("started", p.started))}
      <div class="grid2">${field(t("f.dryDays"), numIn("wet.dryDays", w.dryDays))}${field(t("f.dryNotes"), textIn("wet.dryNotes", w.dryNotes))}</div>
      ${field(t("f.notes"), area("notes", p.notes))}`;
  },
  bisque(p, c, u) {
    const b = p.bisque || {};
    return `
      <span class="lbl">${t("f.dimsBisque")} (${esc(u)})</span>
      ${dims("bisque", b, u, shapeFields(p))}
      ${calcRow("shrinkB", t("f.shrinkBisque"), c)}
      ${handleBlock("bisque", b, u, false, c)}
      ${field(t("f.weightBisque"), numIn("bisque.weight", b.weight))}
      ${calcRow("lossB", t("f.lossBisque"), c)}
      ${tripHistory(p, "bisque")}
      ${field(t("f.homeFiring"), firingSelect("bisque.firingId", b.firingId, "bisque"))}`;
  },
  glaze(p, c, u) {
    const g = p.glaze || {}, f = p.final || {};
    return `
      ${field(t("f.glazes"), chips("glaze.glazes", [...new Set([...listValues("glazes"), ...(g.glazes || [])])], g.glazes, (v) => v, { add: "glazes" }))}
      ${field(t("f.method"), chips("glaze.method", METHODS, g.method, (v) => t("method." + v)))}
      ${glazeBlock(p, c)}
      ${tripHistory(p, "glaze")}
      ${field(t("f.homeFiring"), firingSelect("glaze.firingId", g.firingId, "glaze"))}
      <span class="lbl">${t("f.dimsFinal")} (${esc(u)})</span>
      ${dims("final", f, u, shapeFields(p))}
      ${calcRow("shrinkF", t("f.shrinkFinal"), c)}
      ${handleBlock("final", f, u, false, c)}
      ${field(t("f.weightFinal"), numIn("final.weight", f.weight))}
      ${calcRow("lossF", t("f.lossFinal"), c)}
      ${field(t("f.outcome"), chips("final.outcome", OUTCOMES, f.outcome, (v) => t("outcome." + v), { single: true, cls: "oc" }))}
      ${f.outcome && f.outcome !== "success" ? field(t("f.defects"), chips("final.defects", DEFECTS, f.defects, (v) => t("defect." + v))) : ""}
      ${f.outcome && f.outcome !== "success" && (f.defects || []).includes("other") ? field(t("f.defectOther"), textIn("final.defectOther", f.defectOther)) : ""}`;
  },
  design(p) {
    const designs = Object.values(DB.designs).sort((a, b) => b.createdAt - a.createdAt);
    const insps = (p.inspIds || []).map((id) => DB.insps[id]).filter(Boolean);
    return `
      ${field(t("f.design"), `<div class="row"><select data-f="designId"><option value="">${t("none")}</option>${designs.map((d) => `<option value="${esc(d.id)}"${d.id === p.designId ? " selected" : ""}>${esc(designName(d))}</option>`).join("")}</select>${p.designId && DB.designs[p.designId] ? `<a class="btn small ghost" href="#/design/${esc(p.designId)}">›</a>` : ""}</div>`)}
      <span class="lbl">${t("f.inspirations")}</span>
      <div class="mini-grid">${insps.map((x) => `<div class="mini">${img(x.image)}<a href="#/insp/${esc(x.id)}" class="cover-link"></a><button class="icon-btn over" data-act="insp-unlink" data-id="${esc(x.id)}">${ICON.x}</button></div>`).join("")}
        <button class="mini add" data-act="insp-pick">${ICON.plus}</button></div>`;
  },
  cost(p) {
    const s = p.sale || {}, k = pieceCost(p);
    const line = (lbl, v, note) => v ? `<div class="costrow"><span>${esc(lbl)}${note ? ` <i>${esc(note)}</i>` : ""}</span><b>${esc(money(v))}</b></div>` : "";
    const fired = ["bisque", "glaze"].map((x) => p[x] && p[x].firingId).filter((fid) => DB.firings[fid]);
    const shareNote = fired.length ? t("cost.perPiece", { n: firingShare(fired[0]).n }) : "";
    const feeNote = fired.length && fired.every((fid) => byWeight(DB.firings[fid])) ? t("cost.byWeight") : shareNote;
    const clayNote = k.clayG ? `${fmt(k.clayG, 0)} g · ${t(k.clayBasis === "trim" ? "cost.basisTrim" : "cost.basisWet").toLowerCase()}` : "";
    return `
      ${field(t("cost.clayBy"), chips("clayBasis", ["wet", "trim"], clayBasis(), (v) => t(v === "trim" ? "cost.basisTrim" : "cost.basisWet"), { single: true }))}
      <div class="costs">
        ${line(t("cost.clay"), k.clay, clayNote)}
        ${line(t("cost.glaze"), k.glaze)}
        ${line(t("cost.firing"), k.firing, feeNote)}
        ${line(t("cost.travel"), k.travel, shareNote)}
        ${line(t("cost.other"), k.other, p.otherNote || "")}
        <div class="costrow total"><span>${t("cost.total")}</span><b data-calc="costTotal">${k.total ? esc(money(k.total)) : "–"}</b></div>
        ${k.missing.length ? `<p class="meta">${t("cost.noRate")}: ${esc([...new Set(k.missing)].join(", "))}</p>` : ""}
        <a class="btn small ghost how" href="#/pcost/${esc(p.id)}">${t("bd.how")} ›</a>
        ${s.status === "sold" && k.total ? `<div class="costrow"><span>${t("cost.profit")}</span><b>${esc(money(salePrice(p) - k.total))}</b></div>` : ""}
      </div>
      <div class="grid2">${field(`${t("cost.other")} (${esc(SETTINGS.currency)})`, numIn("otherCost", p.otherCost))}${field(t("cost.otherNote"), textIn("otherNote", p.otherNote))}</div>
      ${field(t("f.saleStatus"), chips("sale.status", SALES, s.status || "not", (v) => t("sale." + v), { single: true }))}
      ${s.status && s.status !== "not" ? `
        <div class="grid2">${field(`${t("f.askPrice")} (${esc(SETTINGS.currency)})`, numIn("sale.ask", s.ask))}${s.status === "sold" ? field(`${t("f.salePrice")} (${esc(SETTINGS.currency)})`, numIn("sale.price", s.price)) : ""}</div>
        ${field(t("f.channel"), textIn("sale.channel", s.channel ? label("chan", s.channel) : "", "", "dl-channels"))}
        ${s.status === "sold" ? `<div class="grid2">${field(t("f.soldDate"), dateIn("sale.soldDate", s.soldDate))}${field(t("f.buyer"), textIn("sale.buyer", s.buyer))}</div>` : ""}` : ""}`;
  }
};


let FIRE_WHERE = "studio";
VIEWS.firings = () => {
  const where = FIRE_WHERE === "home" ? "home" : "studio";
  const words = `<div class="toolbar"><div class="wordtabs">${["studio", "home"].map((w) => `<button data-act="fire-where" data-val="${w}" aria-pressed="${where === w}">${t("fire.tab." + w)}</button>`).join("")}</div></div>`;
  if (where === "home") {
    const fs = Object.values(DB.firings).sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.createdAt - a.createdAt);
    return `${words}<div class="cards boxes">${fs.map((f) => {
      const ps = piecesInFiring(f.id);
      return swipeable(`<a class="card firing" href="#/firing/${esc(f.id)}">
        <div class="card-body"><div class="card-title">${esc(dateText(f.date, true))} · ${esc(label("ftype", f.type))}</div>
        <div class="meta">${esc([f.cone, t("pieces.count", { n: ps.length })].filter(Boolean).join(" · "))}</div></div>
        ${firingPhotos(ps)}</a>`, "firings", f.id);
    }).join("") || empty(t("empty.firings"))}</div>
    <div class="fab"><button class="btn primary" data-act="new-firing">${ICON.plus} ${t("btn.newFiring")}</button></div>`;
  }
  const waiting = atStudio();
  return `${words}
    ${waiting.length ? `<div class="panel waiting"><div class="row between"><b>${t("trip.atStudio")} (${waiting.length})</b><button class="btn small" data-act="new-collect">${t("trip.newCollect")}</button></div>
      <div class="wait-list">${waiting.map((w) => `<a class="wait" href="#/piece/${esc(w.p.id)}">${img(coverOf(w.p), "thumb")}<span><b>${esc(pieceName(w.p))}</b>
        <i>${esc([label("ftype", w.item.firing === "glaze" ? "glaze" : "bisque"), t("trip.since", { date: dateText(w.drop.date) }), w.drop.studio ? label("studio", w.drop.studio) : ""].filter(Boolean).join(" · "))}</i></span></a>`).join("")}</div></div>` : ""}
    <div class="cards boxes">${tripsSorted().map(tripCard).join("") || empty(t("empty.trips"))}</div>
    <div class="fab"><button class="btn" data-act="new-collect">${t("trip.newCollect")}</button><button class="btn primary" data-act="new-drop">${ICON.plus} ${t("trip.newDrop")}</button></div>`;
};
function tripCard(tr) {
  const items = liveItems(tr), cost = (tr.kind === "drop" ? tripFeeTotal(tr) : 0) + n0(tr.fare);
  const what = tr.kind === "drop"
    ? TRIP_TYPES.map((ty) => { const k = items.filter((x) => (x.firing === "glaze" ? "glaze" : "bisque") === ty).length; return k ? `${label("ftype", ty)} ${k}` : ""; }).filter(Boolean).join(" · ")
    : t("pieces.count", { n: items.length });
  return swipeable(`<a class="card firing" href="#/trip/${esc(tr.id)}">
    <div class="card-body"><div class="card-title">${esc(dateText(tr.date, true))} · ${esc(t(tr.kind === "drop" ? "trip.drop" : "trip.collect"))}</div>
    <div class="meta">${esc([tr.studio ? label("studio", tr.studio) : "", what, cost ? money(cost) : ""].filter(Boolean).join(" · "))}</div></div>
    ${firingPhotos(items.map((x) => DB.pieces[x.pieceId]))}</a>`, "trips", tr.id);
}

/* One drop-off or collection: studio, date, fare, then the pieces. A drop-off groups them by
 * firing, each group with its cone, and works out the fee from the studio's prices. */
VIEWS.trip = (r) => {
  const tr = DB.trips[r.id];
  if (!tr) return null;
  const drop = tr.kind === "drop", c = tripCalc(tr), rows = tripFees(tr);
  const studios = [...new Set([...listValues("studios"), tr.studio].filter(Boolean))];
  const prow = (row) => `<div class="card piece slim"><a href="#/piece/${esc(row.p.id)}" class="cover-link"></a>${img(coverOf(row.p), "thumb")}<div class="card-body"><div class="card-title">${esc(pieceName(row.p))}</div><div class="meta" data-calc="tp-${esc(row.p.id)}">${esc(c["tp-" + row.p.id])}</div></div><button class="icon-btn" data-act="trip-unlink" data-id="${esc(row.p.id)}">${ICON.x}</button></div>`;
  const groups = drop ? TRIP_TYPES.map((ty) => {
    const rs = rows.filter((x) => x.type === ty), used = conesUsed(ty), cone = (tr.cone || {})[ty] || "";
    const others = used.filter((u) => u !== cone).slice(0, 6);
    return `<div class="tgroup">
      <div class="row between"><span class="lbl">${t("trip.for." + ty)} (${rs.length})</span><button class="btn small" data-act="trip-pick" data-val="${ty}">${ICON.plus} ${t("btn.addPieces")}</button></div>
      ${rs.length ? `${field(t("f.cone"), textIn(`cone.${ty}`, cone, ty === "bisque" ? (LANG === "zh" ? "素烧 / 900°C" : "Bisque / 900°C") : (LANG === "zh" ? "6号锥 / 1230°C" : "Cone 6 / 1230°C")))}
        ${others.length ? `<div class="chips scroll cones">${others.map((u) => `<button type="button" class="chip" data-act="cone-pick" data-type="${ty}" data-val="${esc(u)}">${esc(u)}</button>`).join("")}</div>` : ""}
        <div class="cards">${rs.map(prow).join("")}</div>` : ""}
    </div>`;
  }).join("") : `<div class="row between"><span class="lbl">${t("trip.collected")} (${rows.length})</span><button class="btn small" data-act="trip-pick-collect">${ICON.plus} ${t("trip.fromStudio")}</button></div>
    ${rows.length ? `<div class="cards">${rows.map(prow).join("")}</div>` : ""}`;
  const allPriced = rows.length && rows.every((x) => x.base > 0);
  const st = tr.studio ? studioOf(tr.studio) : null;
  return `<div data-rec data-coll="trips" data-id="${esc(tr.id)}" class="editor pad">
    ${field(t("fire.studioName"), chips("studio", studios, tr.studio, (v) => label("studio", v), { single: true, add: "studios" }))}
    ${tr.studio && drop ? `<button class="linkish prices" data-act="studio-open" data-val="${esc(tr.studio)}">${esc(pricesText(tr.studio))} · ${t(st ? "trip.editPrices" : "trip.setPrices")} ›</button>` : ""}
    <div class="grid2">${field(t("f.date"), dateIn("date", tr.date))}${field(`${t(drop ? "fire.fareThere" : "fire.fareBack")} (${esc(SETTINGS.currency)})`, numIn("fare", tr.fare))}</div>
    ${groups}
    ${drop && rows.length ? `<div class="panel tripfee">
      ${field(`${t("trip.feePaid")} (${esc(SETTINGS.currency)})`, numIn("feePaid", tr.feePaid, c.feeEst === "–" ? "" : c.feeEst).replace("<input ", '<input data-calc-ph="feeEst" '))}
      ${has(tr.feePaid) && !allPriced ? field(t("trip.shareBy"), chips("split", ["pieces", "weight"], tr.split === "weight" ? "weight" : "pieces", (v) => t("trip.split." + v), { single: true })) : ""}
      <p class="meta">${t("trip.feeHint")}</p>
    </div>` : ""}
    ${calcRow("tripTotal", t(drop ? "trip.totalDrop" : "trip.totalCollect"), c)}
    ${field(t("f.notes"), textIn("note", tr.note))}
    <button class="btn danger wide" data-act="delete" data-coll="trips">${t("btn.delete")}</button>
  </div>`;
};
function tripCalc(tr) {
  const rows = tripFees(tr), n = rows.length || 1;
  const est = rows.reduce((a, r) => a + n0(r.base), 0);
  const out = { feeEst: est ? est.toFixed(2) : "–" };
  const total = (tr.kind === "drop" ? tripFeeTotal(tr) : 0) + n0(tr.fare);
  out.tripTotal = total ? money(total) : "–";
  for (const r of rows) {
    const bits = [];
    if (tr.kind === "collect") { const d = DB.trips[r.x.dropId]; bits.push(label("ftype", r.type), d ? t("trip.droppedOn", { date: dateText(d.date) }) : ""); }
    else if (r.pr && r.pr.by === "cm") bits.push(r.h == null ? (has(tr.feePaid) ? "" : t("trip.needHeight")) : `${fmt(r.h)} cm`);
    else if (r.pr && r.pr.by === "kg") bits.push(r.w == null ? (has(tr.feePaid) ? "" : t("cost.noWeight")) : `${fmt(r.w, 0)} g`);
    if (tr.kind === "drop" && r.fee) bits.push(`${t("cost.firing")} ${money(r.fee)}`);
    if (n0(tr.fare)) bits.push(`${t("bd.fares")} ${money(n0(tr.fare) / n)}`);
    out["tp-" + r.p.id] = bits.filter(Boolean).join(" · ");
  }
  return out;
}
function pricesText(name) {
  const bits = TRIP_TYPES.map((ty) => { const pr = studioPrice(name, ty); return pr ? `${label("ftype", ty)} ${money(pr.price)} ${t("studio.per." + pr.by)}` : ""; }).filter(Boolean);
  return bits.length ? bits.join(" · ") : t("trip.noPrices");
}

/* A studio's price list: what each kind of firing costs, and how it's charged. */
VIEWS.studio = (r) => {
  const st = DB.studios[r.id];
  if (!st) return null;
  return `<div data-rec data-coll="studios" data-id="${esc(st.id)}" class="editor pad">
    ${TRIP_TYPES.map((ty) => { const x = st[ty] || {}, by = PRICE_BY.includes(x.by) ? x.by : "kg"; return `<div class="panel">
      <b>${t("trip.price." + ty)}</b>
      ${field(t("studio.charged"), chips(`${ty}.by`, PRICE_BY, by, (v) => t("studio.by." + v), { single: true }))}
      ${field(`${t("studio.price")} (${esc(SETTINGS.currency)} ${t("studio.per." + by)})`, numIn(`${ty}.price`, x.price))}
    </div>`; }).join("")}
    <p class="meta">${t("studio.hint")}</p>
  </div>`;
};

VIEWS.firing = (r) => {
  const f = DB.firings[r.id];
  if (!f) return null;
  const ps = piecesInFiring(f.id);
  const kilns = [...new Set(Object.values(DB.firings).map((x) => x.kiln).filter(Boolean))];
  const where = "home", fc = {};
  return `<div data-rec data-coll="firings" data-id="${esc(f.id)}" class="editor pad">
    ${where === "studio" ? `
      ${field(t("fire.studioName"), chips("studio", [...new Set([...listValues("studios"), f.studio].filter(Boolean))], f.studio, (v) => label("studio", v), { single: true, add: "studios" }))}
      ${field(t("fire.charged"), chips("split", ["pieces", "weight"], byWeight(f) ? "weight" : "pieces", (v) => t("fire.split." + v), { single: true }))}
      ${byWeight(f)
        ? field(`${t("fire.perKg")} (${esc(SETTINGS.currency)})`, numIn("perKg", f.perKg))
        : field(`${t("fire.fee")} (${esc(SETTINGS.currency)})`, numIn("fee", f.fee))}
      <div class="grid2">${field(t("fire.sent"), dateIn("date", f.date))}${field(`${t("fire.fareThere")} (${esc(SETTINGS.currency)})`, numIn("travel", f.travel))}</div>
      <div class="grid2">${field(t("fire.collected"), dateIn("collected", f.collected))}${field(`${t("fire.fareBack")} (${esc(SETTINGS.currency)})`, numIn("travelBack", f.travelBack))}</div>
      ${calcRow("feeTotal", byWeight(f) ? t("fire.feeByWeight") : t("fire.fee"), fc)}
      ${calcRow("perPiece", byWeight(f) ? t("fire.faresPerPiece", { n: ps.length || 1 }) : t("cost.perPiece", { n: ps.length || 1 }), fc)}
    ` : field(t("f.date"), dateIn("date", f.date))}
    ${field(t("f.firingType"), chips("type", FTYPES, f.type, (v) => t("ftype." + v), { single: true }))}
    <div class="grid2">${field(`${t("f.cone")} (${t("optional")})`, textIn("cone", f.cone, LANG === "zh" ? "6号锥 / 1230°C" : "Cone 6 / 1230°C"))}${field(t("f.kiln"), textIn("kiln", f.kiln, "", "dl-kilns"))}</div>
    <datalist id="dl-kilns">${kilns.map((k) => `<option value="${esc(k)}">`).join("")}</datalist>
    ${field(t("f.notes"), area("notes", f.notes, LANG === "zh" ? "升温曲线、保温、观察……" : "Schedule, ramp/hold, observations…"))}
    <div class="row between"><span class="lbl">${t("f.linked")} (${ps.length})</span><button class="btn small" data-act="firing-pick">${ICON.plus} ${t("btn.addPieces")}</button></div>
    <div class="cards">${ps.map((p) => `<div class="card piece slim"><a href="#/piece/${esc(p.id)}" class="cover-link"></a>${img(coverOf(p), "thumb")}<div class="card-body"><div class="card-title">${esc(pieceName(p))}</div><div class="meta">${t("stage." + stageOf(p))}${where === "studio" ? ` · <span data-calc="fp-${esc(p.id)}">${esc(fc["fp-" + p.id])}</span>` : ""}</div></div><button class="icon-btn" data-act="firing-unlink" data-id="${esc(p.id)}">${ICON.x}</button></div>`).join("") || empty(t("empty.linked"))}</div>
    <button class="btn danger wide" data-act="delete" data-coll="firings">${t("btn.delete")}</button>
  </div>`;
};

/** A firing's pieces on the right of its box: one big photo, or two, or one big and two small with a count. */
function firingPhotos(ps) {
  const pics = ps.map(coverOf).filter(Boolean);
  if (!pics.length) return "";
  const cls = pics.length === 2 ? " two" : pics.length > 2 ? " more" : "";
  const shown = pics.slice(0, 3);
  return `<div class="fphotos${cls}">${shown.map((ph, i) => `<span>${img(ph)}${i === 2 && pics.length > 3 ? `<i>+${pics.length - 3}</i>` : ""}</span>`).join("")}</div>`;
}
/** The firing page's figures: the fee, each piece's share, and what each piece weighed in. */
function firingCalc(f) {
  const ps = piecesInFiring(f.id), n = ps.length || 1;
  const out = {
    feeTotal: firingFee(f) ? money(firingFee(f)) : "–",
    perPiece: byWeight(f) ? (faresOf(f) ? money(faresOf(f) / n) : "–") : (firingTotal(f) ? money(firingTotal(f) / n) : "–")
  };
  for (const p of ps) {
    const sh = firingShare(f.id, p);
    out["fp-" + p.id] = byWeight(f) ? (has(sh.w) ? `${fmt(sh.w, 0)} g · ${money(sh.fee + sh.travel)}` : t("cost.noWeight"))
      : (sh.fee + sh.travel ? money(sh.fee + sh.travel) : "");
  }
  return out;
}
function purchaseCalc(b) {
  const out = { orderTotal: orderTotal(b) ? money(orderTotal(b)) : "–" };
  const lines = orderLines(b);
  (b.items || []).forEach((it, i) => {
    const l = lines.find((x) => x.name === it.name && x.kind === (it.kind || "clay"));
    out["rate-" + i] = l && l.grams ? t("buy.rate", { rate: rateText(l.kind, l.total / l.grams) }) : "–";
  });
  return out;
}

function designName(d) { return (d.description || "").split("\n")[0].slice(0, 40) || `${t("ideas.designs")} · ${dateText(new Date(d.createdAt).toISOString().slice(0, 10))}`; }
VIEWS.ideas = () => {
  const tab = SETTINGS.ideasTab;
  const seg = `<div class="toolbar"><div class="wordtabs">${["designs", "insp"].map((x) => `<button data-act="ideas-tab" data-val="${x}" aria-pressed="${tab === x}">${t("ideas." + x)}</button>`).join("")}</div></div>`;
  if (tab === "designs") {
    const ds = Object.values(DB.designs).sort((a, b) => b.createdAt - a.createdAt);
    return `${seg}<div class="tiles">${ds.map((d) => `<a class="tile" href="#/design/${esc(d.id)}" data-hold="designs:${esc(d.id)}">${d.image ? img(d.image) : `<div class="tile-text">${esc(d.description || "")}</div>`}<span class="pill ds-${d.status || "concept"}">${t("dstatus." + (d.status || "concept"))}</span></a>`).join("")}</div>
      ${ds.length ? "" : empty(t("empty.designs"))}
      <div class="fab"><button class="btn primary" data-act="new-design">${ICON.plus} ${t("btn.newDesign")}</button></div>`;
  }
  const is = Object.values(DB.insps).sort((a, b) => b.createdAt - a.createdAt);
  return `${seg}<div class="tiles">${is.map((x) => `<a class="tile" href="#/insp/${esc(x.id)}" data-hold="insps:${esc(x.id)}">${x.image ? img(x.image) : `<div class="tile-text">${esc(x.notes || x.source || "")}</div>`}</a>`).join("")}</div>
    ${is.length ? "" : empty(t("empty.insp"))}
    <div class="fab"><label class="fab-cam"><input type="file" accept="image/*" hidden data-upload="newinsp">${ICON.image}</label><button class="btn primary" data-act="new-insp">${ICON.plus} ${t("btn.newInsp")}</button></div>`;
};

function imageBlock(rec, target) {
  return `<div class="hero">${rec.image ? img(rec.image, "hero-img contain", false) : ""}
    <div class="hero-actions">${uploadBtn(target, false, rec.image ? (LANG === "zh" ? "换图片" : "Replace") : t("btn.addPhoto"))}${rec.image ? `<button class="btn small ghost" data-act="image-del">${ICON.x}</button>` : ""}</div></div>`;
}
VIEWS.design = (r) => {
  const d = DB.designs[r.id];
  if (!d) return null;
  const made = sortedPieces().filter((p) => p.designId === d.id);
  const insps = Object.values(DB.insps).sort((a, b) => b.createdAt - a.createdAt);
  const free = sortedPieces().filter((p) => p.designId !== d.id);
  return `<div data-rec data-coll="designs" data-id="${esc(d.id)}" class="editor">
    ${imageBlock(d, "design")}
    <div class="pad">
    ${field(t("f.description"), area("description", d.description, LANG === "zh" ? "这个想法是……" : "The idea…"))}
    ${field(t("f.status"), chips("status", DSTATUS, d.status || "concept", (v) => t("dstatus." + v), { single: true, cls: "ds" }))}
    ${field(t("f.sparkedBy"), `<div class="row"><select data-f="inspId"><option value="">${t("none")}</option>${insps.map((x) => `<option value="${esc(x.id)}"${x.id === d.inspId ? " selected" : ""}>${esc(inspName(x))}</option>`).join("")}</select>${d.inspId && DB.insps[d.inspId] ? `<a class="btn small ghost" href="#/insp/${esc(d.inspId)}">›</a>` : ""}</div>`)}
    <span class="lbl">${t("f.resultPiece")}</span>
    <div class="cards">${made.map((p) => `<a class="card piece slim" href="#/piece/${esc(p.id)}">${img(coverOf(p), "thumb")}<div class="card-body"><div class="card-title">${esc(pieceName(p))}</div><div class="meta">${t("stage." + stageOf(p))}</div></div></a>`).join("")}</div>
    <select data-act-change="design-link"><option value="">${LANG === "zh" ? "+ 关联作品" : "+ Link a piece"}</option>${free.map((p) => `<option value="${esc(p.id)}">${esc(pieceName(p))}</option>`).join("")}</select>
    <button class="btn danger wide" data-act="delete" data-coll="designs">${t("btn.delete")}</button>
  </div></div>`;
};
function inspName(x) { return (x.notes || x.source || "").split("\n")[0].slice(0, 40) || `${t("ideas.insp")} · ${dateText(new Date(x.createdAt).toISOString().slice(0, 10))}`; }
VIEWS.insp = (r) => {
  const x = DB.insps[r.id];
  if (!x) return null;
  const ps = sortedPieces().filter((p) => (p.inspIds || []).includes(x.id));
  const ds = Object.values(DB.designs).filter((d) => d.inspId === x.id);
  return `<div data-rec data-coll="insps" data-id="${esc(x.id)}" class="editor">
    ${imageBlock(x, "insp")}
    <div class="pad">
    ${field(t("f.source"), textIn("source", x.source, LANG === "zh" ? "小红书 @某某、展览、自己拍的……" : "Xiaohongshu @someone, a gallery, my own photo…"))}
    ${field(t("f.myNotes"), area("notes", x.notes, LANG === "zh" ? "喜欢这个绞胎纹理……" : "Love this marbling texture…"))}
    ${field(t("f.tags"), chips("tags", [...new Set([...listValues("tags"), ...(x.tags || [])])], x.tags, (v) => label("tag", v), { add: "tags" }))}
    ${ps.length || ds.length ? `<span class="lbl">${t("f.usedBy")}</span><div class="cards">
      ${ps.map((p) => `<a class="card piece slim" href="#/piece/${esc(p.id)}">${img(coverOf(p), "thumb")}<div class="card-body"><div class="card-title">${esc(pieceName(p))}</div></div></a>`).join("")}
      ${ds.map((d) => `<a class="card piece slim" href="#/design/${esc(d.id)}">${img(d.image, "thumb")}<div class="card-body"><div class="card-title">${esc(designName(d))}</div><div class="meta">${t("ideas.designs")}</div></div></a>`).join("")}</div>` : ""}
    <button class="btn wide" data-act="design-from-insp">${ICON.plus} ${t("btn.newDesign")}</button>
    <button class="btn danger wide" data-act="delete" data-coll="insps">${t("btn.delete")}</button>
  </div></div>`;
};

let COSTS_TAB = "materials";
VIEWS.costs = () => {
  const words = `<div class="toolbar"><div class="wordtabs">${["materials", "pieces"].map((k) => `<button data-act="costs-tab" data-val="${k}" aria-pressed="${COSTS_TAB === k}">${t("costs." + k)}</button>`).join("")}</div></div>`;
  if (COSTS_TAB === "materials") {
    const buys = Object.values(DB.purchases).sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.createdAt - a.createdAt);
    const spent = buys.reduce((a, b) => a + orderTotal(b), 0);
    const nameOf = (l) => l.kind === "clay" ? label("clay", l.name) : l.name;
    return `${words}
      ${buys.length ? `<div class="rows"><div class="srow">${t("cost.spent")}<span class="v">${esc(money(spent))}</span></div></div>` : ""}
      <div class="cards boxes">${buys.map((b) => {
        const ls = orderLines(b);
        const what = ls.map((l) => nameOf(l) || t("buy." + l.kind)).filter(Boolean).join(", ");
        return swipeable(`<a class="card" href="#/purchase/${esc(b.id)}"><div class="card-body">
          <div class="card-title">${esc(b.store ? label("store", b.store) : (what || t("buy.new")))}</div>
          <div class="meta">${esc([b.store ? what : "", dateText(b.date), has(b.delivery) && Number(b.delivery) ? `${t("buy.delivery")} ${money(b.delivery)}` : ""].filter(Boolean).join(" · "))}</div>
        </div><b>${orderTotal(b) ? esc(money(orderTotal(b))) : ""}</b></a>`, "purchases", b.id);
      }).join("") || empty(t("buy.none"))}</div>
      <div class="fab"><button class="btn primary" data-act="new-purchase">${ICON.plus} ${t("buy.new")}</button></div>`;
  }
  const ps = sortedPieces();
  const made = ps.reduce((a, p) => a + pieceCost(p).total, 0);
  const sold = ps.filter((p) => (p.sale || {}).status === "sold");
  const forSale = ps.filter((p) => (p.sale || {}).status === "for");
  return `${words}
    <div class="pad">${field(t("cost.clayBy"), chips("clayBasis", ["wet", "trim"], clayBasis(), (v) => t(v === "trim" ? "cost.basisTrim" : "cost.basisWet"), { single: true }))}</div>
    <div class="rows">
      <div class="srow">${t("cost.made")}<span class="v">${esc(money(made))}</span></div>
      <div class="srow">${t("cost.sold")}<span class="v">${sold.length ? `${t("pieces.count", { n: sold.length })} · ${esc(money(sold.reduce((a, p) => a + salePrice(p), 0)))}` : "–"}</span></div>
      <div class="srow">${t("cost.forSale")}<span class="v">${forSale.length ? `${t("pieces.count", { n: forSale.length })} · ${esc(money(forSale.reduce((a, p) => a + salePrice(p), 0)))}` : "–"}</span></div>
    </div>
    <div class="cards boxes">${ps.map((p) => {
      const k = pieceCost(p), s = p.sale || {};
      return `<a class="card piece" href="#/pcost/${esc(p.id)}">${img(coverOf(p), "thumb")}<div class="card-body">
        <div class="card-title">${esc(pieceName(p))}</div>
        <div class="meta">${k.total ? esc(`${t("cost.total")} ${money(k.total)}`) : "–"}${s.status && s.status !== "not" ? esc(` · ${t("sale." + s.status)} ${money(salePrice(p))}`) : ""}</div>
      </div></a>`;
    }).join("") || empty(t("empty.pieces"))}</div>`;
};

/** The glaze sum as lines: surface × coats × glaze per coat = ml, × price = cost; typed-in numbers say so. */
function glazeSteps(p, gc, row) {
  const typed = (on) => on ? ` <i class="typed">${t("glz.typed")}</i>` : "";
  const lines = [];
  if (gc.typed.cost) return row(esc(t("glz.cost")) + typed(true), esc(money(gc.cost)));
  if (gc.area != null) {
    lines.push(row(esc(t("glz.area")) + typed(gc.typed.area), `${fmt(gc.area, 0)} cm²`));
    if (!gc.typed.area && gc.size) lines.push(`<p class="meta bd-note">${esc(t("glz.from." + gc.size.stage, { dims: gc.size.dims }))}</p>`);
  }
  if (!gc.typed.ml && gc.area != null) lines.push(row(esc(t("glz.mlSum", { area: fmt(gc.area, 0), coats: gc.coats, cov: fmt(gc.coverage, 2) })) + typed(gc.typed.coats), `${fmt(gc.ml, 0)} ml`));
  else lines.push(row(esc(t("cost.glazeUsed")) + typed(true), `${fmt(gc.ml, 0)} ml`));
  const names = ((p.glaze || {}).glazes || []).join(", ");
  lines.push(row(`${esc(fmt(gc.ml, 0))} ml × ${esc(rateText("glaze", gc.rate))}${typed(gc.typed.rate)}${!gc.typed.rate && names ? ` <i>${esc(names)}</i>` : ""}${!gc.typed.rate && gc.rateFrom === "all" ? ` <i>${t("glz.avgAll")}</i>` : ""}`, esc(money(gc.cost))));
  return lines.join("") + `<a class="bd-link" href="#/piece/${esc(p.id)}" data-act="to-glaze">${t("glz.change")} ›</a>`;
}
/* How one piece's cost is worked out, step by step: the clay it used at what you paid for that
 * clay, its share of each firing's fee, and its share of the fares there and back. */
VIEWS.pcost = (r) => {
  const p = DB.pieces[r.id];
  if (!p) return null;
  const k = pieceCost(p), s = p.sale || {};
  const row = (a, b, cls = "") => `<div class="bd-row ${cls}"><span>${a}</span><b>${b}</b></div>`;
  const box = (title, sum, body) => `<div class="panel bd"><div class="bd-head"><span>${esc(title)}</span><b>${esc(money(sum) || money(0))}</b></div>${body}</div>`;

  // clay
  const usedNote = k.clayBasis === "wet" ? t("bd.wetNote") : t("bd.trimNote", { off: fmt(Math.max(0, k.wetG - k.clayG), 0) });
  let clay = `${field(t("cost.clayBy"), chips("clayBasis", ["wet", "trim"], clayBasis(), (v) => t(v === "trim" ? "cost.basisTrim" : "cost.basisWet"), { single: true }))}`;
  clay += k.clayG ? row(esc(t("bd.clayUsed")), `${fmt(k.clayG, 0)} g`) + `<p class="meta bd-note">${esc(usedNote)}</p>` : "";
  for (const c of k.clayLines) {
    clay += row(`${esc(label("clay", c.type))} · ${fmt(c.grams, 0)} g × ${esc(rateText("clay", c.rate))}`, esc(money(c.cost)));
    const src = rateSources("clay", c.type);
    clay += `<div class="bd-src"><span class="lbl">${esc(t("bd.rateFrom", { rate: rateText("clay", c.rate) }))}</span>
      ${src.map(({ b, l }) => `<div>${esc([b.store ? label("store", b.store) : "", dateText(b.date)].filter(Boolean).join(" · "))}: ${esc(t(l.share ? "bd.order" : "bd.orderNoDel", { amt: amountText("clay", l.grams), cost: money(l.cost), del: money(l.share) }))}</div>`).join("")}
      ${src.length > 1 ? `<div>${esc(t("bd.avg", { cost: money(src.reduce((a, x) => a + x.l.total, 0)), amt: amountText("clay", src.reduce((a, x) => a + x.l.grams, 0)), n: src.length }))}</div>` : ""}</div>`;
  }
  if (!k.clayLines.length) clay += `<p class="meta">${esc(k.clayG ? [...new Set(k.missing)].join(" · ") : t("bd.noClay"))}</p>`;

  // firing and the fares there and back
  let fire = "";
  for (const x of k.fires) {
    const f = x.f;
    fire += `<div class="bd-fire"><a class="bd-link" href="#/firing/${esc(x.fid)}">${esc(firingName(f))}${f.where === "studio" && f.studio ? " · " + esc(label("studio", f.studio)) : ""} ›</a>`;
    if ((f.where || "home") !== "studio") fire += `<p class="meta">${t("bd.home")}</p>`;
    else {
      fire += byWeight(f)
        ? row(esc(t("bd.feeWeight", { g: has(x.w) ? fmt(x.w, 0) : "?", rate: `${money(f.perKg)} ${t("unit.perKg")}` })), esc(money(x.fee)))
        : row(esc(t("bd.feeSplit", { fee: money(n0(f.fee)), n: t("pieces.count", { n: x.n }) })), esc(money(x.fee)));
      fire += row(esc(t("bd.faresSplit", { there: money(n0(f.travel)), back: money(n0(f.travelBack)), n: t("pieces.count", { n: x.n }) })), esc(money(x.travel)));
    }
    fire += `</div>`;
  }
  for (const x of k.trips) {
    const tr = x.tr, r = x.row, ty = label("ftype", r.type);
    fire += `<div class="bd-fire"><a class="bd-link" href="#/trip/${esc(tr.id)}">${esc(tripName(tr))}${tr.kind === "drop" && (tr.cone || {})[r.type] ? " · " + esc(tr.cone[r.type]) : ""} ›</a>`;
    if (tr.kind === "drop") {
      const how = r.how === "share" ? t("bd.feeShare", { type: ty, fee: money(Number(tr.feePaid)) })
        : r.how === "kg" ? t("bd.feeKg", { type: ty, g: fmt(r.w, 0), rate: `${money(r.pr.price)} ${t("studio.per.kg")}` })
        : r.how === "cm" ? t("bd.feeCm", { type: ty, h: fmt(r.h), rate: `${money(r.pr.price)} ${t("studio.per.cm")}` })
        : r.how === "piece" ? t("bd.feePiece", { type: ty })
        : t(r.how === "missing" ? (r.pr.by === "cm" ? "trip.needHeight" : "cost.noWeight") : "trip.needPrice", { studio: tr.studio ? label("studio", tr.studio) : t("fire.studio") });
      fire += row(esc(how), esc(money(r.fee)));
    }
    fire += row(esc(t(tr.kind === "drop" ? "bd.fareThere" : "bd.fareBack", { fare: money(n0(tr.fare)), n: t("pieces.count", { n: x.n }) })), esc(money(x.fare)));
    fire += `</div>`;
  }
  if (!k.fires.length && !k.trips.length) fire = `<p class="meta">${t("bd.noFiring")}</p>`;

  const extra = [
    k.glazeLine ? box(t("cost.glaze"), k.glaze, glazeSteps(p, k.glazeLine, row)) : "",
    k.other ? box(t("cost.other"), k.other, p.otherNote ? `<p class="meta">${esc(p.otherNote)}</p>` : "") : ""
  ].join("");
  const sumParts = [[t("cost.clay"), k.clay], [t("cost.firing"), k.firing], [t("bd.fares"), k.travel], [t("cost.glaze"), k.glaze], [t("cost.other"), k.other]].filter(([, v], i) => i < 3 || v);
  return `<div class="editor">
    <a class="bd-top" href="#/piece/${esc(p.id)}">${img(coverOf(p), "thumb")}<span><b>${esc(pieceName(p))}</b><i>${t("bd.open")} ›</i></span></a>
    ${box(t("cost.clay"), k.clay, clay)}
    ${box(t("bd.fireTitle"), k.firing + k.travel, fire)}
    ${extra}
    <div class="panel bd total">
      ${sumParts.map(([a, v]) => row(esc(a), esc(money(v)))).join("")}
      ${row(esc(t("cost.total")), esc(money(k.total)), "sum")}
      ${s.status === "sold" || s.status === "for" ? row(esc(t(s.status === "sold" ? "f.salePrice" : "f.askPrice")), esc(money(salePrice(p)))) + row(esc(t("cost.profit")), esc(money(salePrice(p) - k.total)), "sum") : ""}
    </div>
  </div>`;
};

VIEWS.purchase = (r) => {
  const b = DB.purchases[r.id];
  if (!b) return null;
  const pc = purchaseCalc(b);
  const rows = (b.items || []).map((it, i) => {
    const kind = it.kind || "clay";
    const names = [...new Set([...listValues(kind === "glaze" ? "glazes" : "clay"), it.name].filter(Boolean))];
    return `<div class="item">
      <div class="item-top">
        <select data-f="items.${i}.kind">${["clay", "glaze"].map((k) => `<option value="${k}"${k === kind ? " selected" : ""}>${t("buy." + k)}</option>`).join("")}</select>
        <select data-f="items.${i}.name" data-list="${kind === "glaze" ? "glazes" : "clay"}"><option value="">${t("buy.name")}</option>${names.map((v) => `<option value="${esc(v)}"${v === it.name ? " selected" : ""}>${esc(kind === "clay" ? label("clay", v) : v)}</option>`).join("")}<option value="__new__">+ …</option></select>
        <button class="icon-btn" data-act="item-del" data-i="${i}" aria-label="${t("btn.delete")}">${ICON.x}</button>
      </div>
      <div class="item-num">
        <label><span>${t(kind === "glaze" ? "buy.amountMl" : "buy.amountKg")}</span>${kind === "glaze" ? numIn(`items.${i}.grams`, it.grams) : numIn(`items.${i}.grams`, it.grams, "", 1000)}</label>
        <label><span>${t("buy.cost")} (${esc(SETTINGS.currency)})</span>${numIn(`items.${i}.cost`, it.cost)}</label>
      </div>
      <div class="meta rate"${pc["rate-" + i] === "–" ? " hidden" : ""} data-calc="rate-${i}">${esc(pc["rate-" + i])}</div>
    </div>`;
  }).join("");
  return `<div data-rec data-coll="purchases" data-id="${esc(b.id)}" class="editor pad">
    ${field(t("buy.store"), chips("store", [...new Set([...listValues("stores"), b.store].filter(Boolean))], b.store, (v) => label("store", v), { single: true, add: "stores" }))}
    <div class="grid2">${field(t("f.date"), dateIn("date", b.date))}${field(`${t("buy.delivery")} (${esc(SETTINGS.currency)})`, numIn("delivery", b.delivery))}</div>
    <span class="lbl">${t("buy.items")}</span>
    ${rows}
    <button class="btn small" data-act="item-add">${ICON.plus} ${t("buy.addItem")}</button>
    ${calcRow("orderTotal", t("buy.orderTotal"), pc)}
    ${has(b.delivery) && Number(b.delivery) ? `<p class="meta">${t("buy.deliveryNote")}</p>` : ""}
    ${field(t("f.notes"), textIn("note", b.note))}
    <button class="btn danger wide" data-act="delete" data-coll="purchases">${t("btn.delete")}</button>
  </div>`;
};

VIEWS.more = () => {
  return VIEWS.settings();
};

VIEWS.settings = () => {
  const u = window.cloud && cloud.user;
  const pend = Photos.pending().length;
  const listEd = (name, lab, labFn) => `<div class="fgroup"><span class="lbl">${lab}</span><div class="chips">${listValues(name).map((v) => `<span class="chip listed">${esc(labFn(v))}<button data-act="list-remove" data-list="${name}" data-val="${esc(v)}" aria-label="${t("btn.delete")}">×</button></span>`).join("")}<button class="chip add" data-act="list-add" data-list="${name}">+</button></div></div>`;
  return `<div class="pad settings">
    <h3>${t("set.language")}</h3>
    <div class="chips"><button class="chip" data-act="lang" data-val="${LANG === "zh" ? "en" : "zh"}">${LANG === "zh" ? "中文" : "English"} ${ICON.swap}</button></div>
    <h3>${t("set.account")}</h3>
    <div class="panel">${!window.cloud ? "<p class='meta'>Supabase isn't configured.</p>" : u ? `
      <p>${esc(t("set.signedInAs", { email: u.email }))}</p>
      <p class="meta" id="sync-line">${syncLine()}</p>
      ${pend ? `<p class="meta">${t("set.pending", { n: pend })}</p>` : ""}
      <div class="row"><button class="btn" data-act="sync">${t("set.syncNow")}</button><button class="btn ghost" data-act="sign-out">${t("set.signOut")}</button></div>` : `
      <p class="meta">${t("set.accountHint")}</p>
      <form id="auth" class="auth">
        <input type="email" name="email" autocomplete="email" placeholder="${t("set.email")}" required>
        <input type="password" name="password" autocomplete="current-password" placeholder="${t("set.password")}" required minlength="6">
        <div class="row"><button class="btn primary" data-act="sign-in">${t("set.signIn")}</button><button class="btn" data-act="sign-up">${t("set.signUp")}</button></div>
        <button class="linkish" data-act="forgot">${t("set.forgot")}</button>
      </form>
      ${pend ? `<p class="meta">${t("sync.needSignIn")}</p>` : ""}`}</div>

    <h3>${t("set.currency")} · ${t("set.unit")}</h3>
    <div class="panel"><div class="grid2"><input type="text" data-setting="currency" value="${esc(SETTINGS.currency)}" maxlength="4">
      <select data-setting="unit">${UNITS.map((x) => `<option${x === SETTINGS.unit ? " selected" : ""}>${x}</option>`).join("")}</select></div></div>

    <h3>${t("set.lists")}</h3>
    ${listEd("tags", t("set.listTags"), (v) => label("tag", v))}
    ${listEd("clay", t("set.listClay"), (v) => label("clay", v))}
    ${listEd("glazes", t("set.listGlazes"), (v) => v)}
    ${listEd("channels", t("set.listChannels"), (v) => label("chan", v))}

    <h3>${t("set.backups")}</h3>
    <div class="panel">
      <p class="meta">${t("set.backupsHint")}</p>
      <div id="backup-list" class="rows"><div class="srow meta">${t("set.loading")}</div></div>
    </div>

    <h3>${t("set.backup")}</h3>
    <div class="panel"><p class="meta">${t("set.stats", { p: Object.keys(DB.pieces).length, f: Object.keys(DB.firings).length, d: Object.keys(DB.designs).length, i: Object.keys(DB.insps).length })}</p>
    <div class="row"><button class="btn" data-act="export">${t("set.export")}</button>
      <label class="btn">${t("set.import")}<input type="file" accept="application/json,.json" hidden data-import></label></div></div>
    <h3>${t("set.update")}</h3>
    <div class="panel"><p class="meta">${t("set.updateHint")}</p>
    <button class="btn" data-act="force-update">${t("set.forceUpdate")}</button></div>
    <p class="meta ver">v${APP_VERSION}</p>
  </div>`;
};
/** Fills in the backup list once the phone and the cloud have answered. */
async function paintBackups() {
  const box = $("#backup-list");
  if (!box) return;
  const rows = [];
  for (const key of await Backups.all()) {
    const snap = await Backups.read(key);
    if (snap) rows.push({ where: "phone", key, at: snap.at, n: Backups.count(snap.data), data: snap.data });
  }
  let cloudRows = [];
  if (window.cloud && cloud.user) {
    try {
      const list = await cloud.snapshots();
      if (list === null) rows.push({ note: t("set.backupsSql") });
      else cloudRows = list.map((r) => ({ where: "cloud", key: r.id, at: new Date(r.created_at).getTime(), n: Backups.count(r.data), data: r.data }));
    } catch (e) { rows.push({ note: cloud.explain(e) }); }
  }
  const items = [...rows.filter((r) => !r.note), ...cloudRows].sort((a, b) => b.at - a.at);
  BACKUPS = items;
  const notes = rows.filter((r) => r.note).map((r) => `<div class="srow meta">${esc(r.note)}</div>`).join("");
  box.innerHTML = (items.map((r, i) => `<div class="srow">
      <span>${esc(dateText(new Date(r.at).toISOString().slice(0, 10), true))} <i class="meta">${r.where === "cloud" ? t("set.inCloud") : t("set.onPhone")}</i></span>
      <span class="v">${t("set.backupItems", { n: r.n })} <button class="btn small" data-act="restore" data-i="${i}">${t("set.restore")}</button></span>
    </div>`).join("") || `<div class="srow meta">${t("set.noBackups")}</div>`) + notes;
}
let BACKUPS = [];

function syncLine() {
  const s = Sync.state;
  if (s.status === "syncing") return t("sync.syncing");
  if (s.status === "error") return t("sync.err", { msg: s.msg });
  if (s.status === "offline") return t("sync.offline");
  return s.last ? t("set.lastSync", { when: ago(s.last) }) : "";
}

// ---------- drawing
function render(keepScroll) {
  const y = window.scrollY;
  PHOTO_INDEX = new Map();
  const view = VIEWS[ROUTE.name];
  let html = view ? view(ROUTE) : null;
  if (html == null) { ROUTE = { name: TAB_OF[ROUTE.name] || "pieces" }; history.replaceState(null, "", "#/" + ROUTE.name); html = VIEWS[ROUTE.name](ROUTE); }
  $("#main").innerHTML = html + `<datalist id="dl-channels">${listValues("channels").map((v) => `<option value="${esc(label("chan", v))}">`).join("")}</datalist>`;
  const detail = !!TAB_OF[ROUTE.name];
  const tab = TAB_OF[ROUTE.name] || ROUTE.name;
  $("#back").hidden = !detail;
  $("#title").textContent = detail ? detailTitle() : t("tab." + tab);
  $("#lang").textContent = LANG === "zh" ? "EN" : "中";
  $("#gear").innerHTML = ICON.settings;
  $("#gear").setAttribute("aria-pressed", ROUTE.name === "more" || ROUTE.name === "settings");
  document.title = t("app");
  $$("#tabs a").forEach((a) => { a.setAttribute("aria-current", a.dataset.tab === tab ? "page" : "false"); a.setAttribute("aria-label", t("tab." + a.dataset.tab)); });
  paintSync();
  if (ROUTE.name === "more" || ROUTE.name === "settings") paintBackups();
  hydrate($("#main"));
  if (keepScroll) window.scrollTo(0, y);
}
function detailTitle() {
  const r = ROUTE;
  if (r.name === "piece") return pieceName(DB.pieces[r.id]);
  if (r.name === "firing") return label("ftype", DB.firings[r.id].type);
  if (r.name === "design") return t("ideas.designs");
  if (r.name === "insp") return t("ideas.insp");
  if (r.name === "more" || r.name === "settings") return t("tab.settings");
  if (r.name === "purchase") return t("buy.order");
  if (r.name === "pcost") return t("bd.title");
  if (r.name === "trip") return t(DB.trips[r.id].kind === "drop" ? "trip.drop" : "trip.collect");
  if (r.name === "studio") return label("studio", DB.studios[r.id].name);
  return "";
}
function hydrate(root) {
  $$("img[data-pid]", root).forEach((el) => {
    const p = PHOTO_INDEX.get(el.dataset.pid);
    const ready = Photos.peek(p, !!el.dataset.thumb);
    if (ready) { el.src = ready; return; }
    Photos.src(p, !!el.dataset.thumb).then((u) => { if (u) el.src = u; else el.classList.add("missing"); });
  });
}
function paintSync() {
  const dot = $("#sync");
  const u = window.cloud && cloud.user;
  const s = Sync.state.status;
  dot.className = "sync " + (!u ? "local" : s);
  dot.title = !u ? t("sync.needSignIn") : syncLine();
  const line = $("#sync-line"); if (line) line.textContent = syncLine();
}
/* Every computed figure on the page refreshes as you type, and a row whose figure has just
 * become available shows itself. */
const CALCS = { piece: (r) => calc(r), firing: () => ({}), trip: (r) => tripCalc(r), purchase: (r) => purchaseCalc(r) };
function updateCalcs(rec) {
  if (!CALCS[ROUTE.name]) return;
  const c = CALCS[ROUTE.name](rec);
  $$("[data-calc]").forEach((el) => {
    const v = c[el.dataset.calc];
    if (v === undefined) return;
    el.textContent = el.closest("summary") && v === "–" ? "" : v;
    const row = el.closest(".calc") || (el.classList.contains("rate") ? el : null);
    if (row) row.hidden = v === "–" || v === "";
  });
  $$("[data-calc-ph]").forEach((el) => { const v = c[el.dataset.calcPh]; if (v !== undefined) el.placeholder = v === "–" ? "" : v; });
  if (ROUTE.name === "piece" && document.activeElement && document.activeElement.dataset.f === "title") $("#title").textContent = pieceName(rec);
}
let pendingRender = false;
/** Sync brought in changes from another device: redraw, unless the user is mid-typing. */
function onRemoteChange() {
  const a = document.activeElement;
  if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && $("#main").contains(a)) { pendingRender = true; return; }
  render(true);
}
document.addEventListener("focusout", () => { if (pendingRender) { pendingRender = false; setTimeout(() => render(true), 50); } });

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg; el.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { el.hidden = true; }, 3200);
}

// ---------- sheets (photo viewer, pickers)
let SHEET = null;   // { kind, ... }
function openSheet(s) { SHEET = s; drawSheet(); document.body.classList.add("sheet-open"); }
function closeSheet() { SHEET = null; $("#sheet").hidden = true; $("#sheet").innerHTML = ""; document.body.classList.remove("sheet-open"); }
function drawSheet() {
  if (!SHEET) return;
  PHOTO_INDEX = PHOTO_INDEX || new Map();
  const el = $("#sheet");
  // redrawing the same sheet (ticking a piece in a list) keeps the list where it was scrolled to
  const same = drawSheet.last === SHEET, old = $(".sheet-card", el), y = same && old ? old.scrollTop : 0;
  el.hidden = false;
  el.innerHTML = `<div class="sheet-back" data-act="sheet-close"></div><div class="sheet-card">${SHEET_VIEWS[SHEET.kind]()}</div>`;
  if (y) $(".sheet-card", el).scrollTop = y;
  drawSheet.last = SHEET;
  hydrate(el);
}
function sheetPhoto() {
  const rec = DB[SHEET.coll][SHEET.id];
  return { rec, ph: rec && photosOf(rec).find((x) => x.id === SHEET.pid) };
}
const SHEET_VIEWS = {
  photo() {
    const { rec, ph } = sheetPhoto();
    if (!ph) { setTimeout(closeSheet); return ""; }
    const isPiece = SHEET.coll === "pieces";
    return `<button class="icon-btn close" data-act="sheet-close">${ICON.x}</button>
      <div class="big">${img(ph, "big-img", false)}</div>
      ${isPiece ? `
        ${field(t("f.photoStage"), chips("ph.stage", STAGES, ph.stage, (v) => t("stage." + v), { single: true }))}
        ${field(t("f.photoTags"), chips("ph.tags", [...new Set([...listValues("tags"), ...(ph.tags || [])])], ph.tags, (v) => label("tag", v), { add: "tags" }))}
        <label class="field"><span>${t("f.date")}</span><input type="date" data-ph="at" value="${esc(ph.at || "")}"></label>
        <div class="row">${ROUTE.name !== "piece" ? `<a class="btn primary" href="#/piece/${esc(rec.id)}">${t("btn.openPiece")}</a>` : ""}
          ${rec.cover !== ph.id ? `<button class="btn" data-act="ph-cover">★ ${t("btn.cover")}</button>` : ""}
          <label class="btn"><input type="file" accept="image/*" hidden data-upload="replace">${t("btn.replace")}</label>
          <button class="btn danger" data-act="ph-delete">${t("btn.delete")}</button></div>` : ""}`;
  },
  /** Hold a photo: swap it for another, make it the cover, or delete it. */
  photoMenu() {
    const { rec, ph } = sheetPhoto();
    if (!ph) { setTimeout(closeSheet); return ""; }
    return `<button class="icon-btn close" data-act="sheet-close">${ICON.x}</button>
      <div class="menu-head">${img(ph, "menu-img")}<span>${t("stage." + ph.stage)}</span></div>
      <div class="menu">
        <label class="btn wide"><input type="file" accept="image/*" hidden data-upload="replace">${ICON.image} ${t("btn.replacePhoto")}</label>
        ${rec.cover !== ph.id ? `<button class="btn wide" data-act="ph-cover">★ ${t("btn.cover")}</button>` : ""}
        <button class="btn danger wide" data-act="ph-delete">${ICON.trash} ${t("btn.deletePhoto")}</button>
      </div>`;
  },
  /** Hold a piece, design or inspiration tile: open it or delete it. */
  recordMenu() {
    const rec = DB[SHEET.coll] && DB[SHEET.coll][SHEET.id];
    if (!rec) { setTimeout(closeSheet); return ""; }
    const route = { pieces: "piece", designs: "design", insps: "insp", firings: "firing", purchases: "purchase" }[SHEET.coll];
    const pic = SHEET.coll === "pieces" ? coverOf(rec) : rec.image;
    const name = SHEET.coll === "pieces" ? pieceName(rec) : SHEET.coll === "designs" ? designName(rec) : SHEET.coll === "insps" ? inspName(rec) : "";
    return `<button class="icon-btn close" data-act="sheet-close">${ICON.x}</button>
      <div class="menu-head">${pic ? img(pic, "menu-img") : ""}<span>${esc(name)}</span></div>
      <div class="menu">
        <a class="btn wide" href="#/${route}/${esc(rec.id)}">${t("btn.open")}</a>
        <button class="btn danger wide" data-act="menu-delete">${ICON.trash} ${t("btn.delete")}</button>
      </div>`;
  },
  /** Add pieces to a drop-off for one firing. Pieces already waiting at a studio aren't offered. */
  pickDrop() {
    const tr = DB.trips[SHEET.id], ty = SHEET.type;
    const away = new Set(atStudio().filter((w) => w.drop.id !== tr.id).map((w) => w.p.id));
    const want = ty === "bisque" ? "wet" : "bisque";
    const ps = sortedPieces().filter((p) => !away.has(p.id)).sort((a, b) => (stageOf(b) === want) - (stageOf(a) === want));
    return `<button class="icon-btn close" data-act="sheet-close">${ICON.x}</button><h3>${t("trip.for." + ty)}</h3>
      <div class="cards">${ps.map((p) => { const on = (tr.items || []).some((x) => x.pieceId === p.id && (x.firing === "glaze" ? "glaze" : "bisque") === ty); return `<button class="card piece slim pick${on ? " picked" : ""}" data-act="drop-toggle" data-id="${esc(p.id)}">${img(coverOf(p), "thumb")}<div class="card-body"><div class="card-title">${esc(pieceName(p))}</div><div class="meta">${t("stage." + stageOf(p))}</div></div><i class="check">${on ? "✓" : ""}</i></button>`; }).join("") || empty(t("empty.pieces"))}</div>
      <button class="btn primary wide" data-act="sheet-close">${t("btn.done")}</button>`;
  },
  /** Tick what came home: everything still at this studio, plus what this collection already has. */
  pickCollect() {
    const tr = DB.trips[SHEET.id];
    const mine = liveItems(tr).map((x) => ({ drop: DB.trips[x.dropId], item: x, p: DB.pieces[x.pieceId] })).filter((w) => w.drop);
    const list = [...mine, ...atStudio(tr.studio || null)];
    return `<button class="icon-btn close" data-act="sheet-close">${ICON.x}</button><h3>${t("trip.atStudio")}</h3>
      ${list.length > 1 ? `<button class="linkish" data-act="collect-all">${t("trip.selectAll")}</button>` : ""}
      <div class="cards">${list.map((w) => { const on = (tr.items || []).some((x) => x.pieceId === w.p.id && x.dropId === w.drop.id); return `<button class="card piece slim pick${on ? " picked" : ""}" data-act="collect-toggle" data-id="${esc(w.p.id)}" data-drop="${esc(w.drop.id)}">${img(coverOf(w.p), "thumb")}<div class="card-body"><div class="card-title">${esc(pieceName(w.p))}</div><div class="meta">${esc([label("ftype", w.item.firing === "glaze" ? "glaze" : "bisque"), t("trip.droppedOn", { date: dateText(w.drop.date) }), w.drop.studio ? label("studio", w.drop.studio) : ""].filter(Boolean).join(" · "))}</div></div><i class="check">${on ? "✓" : ""}</i></button>`; }).join("") || empty(t("trip.nothingWaiting"))}</div>
      <button class="btn primary wide" data-act="sheet-close">${t("btn.done")}</button>`;
  },
  pickInsp() {
    const p = DB.pieces[SHEET.id];
    const is = Object.values(DB.insps).sort((a, b) => b.createdAt - a.createdAt);
    return `<button class="icon-btn close" data-act="sheet-close">${ICON.x}</button><h3>${t("f.inspirations")}</h3>
      <div class="tiles">${is.map((x) => `<button class="tile${(p.inspIds || []).includes(x.id) ? " picked" : ""}" data-act="insp-toggle" data-id="${esc(x.id)}">${x.image ? img(x.image) : `<div class="tile-text">${esc(inspName(x))}</div>`}</button>`).join("")}</div>
      ${is.length ? "" : empty(t("empty.insp"))}
      <button class="btn primary wide" data-act="sheet-close">${t("btn.done")}</button>`;
  },
  pickPieces() {
    const f = DB.firings[SHEET.id];
    const key = f.type === "bisque" ? "bisque" : "glaze";
    return `<button class="icon-btn close" data-act="sheet-close">${ICON.x}</button><h3>${t("btn.addPieces")}</h3>
      <div class="cards">${sortedPieces().map((p) => { const on = (p[key] || {}).firingId === f.id; return `<button class="card piece slim pick${on ? " picked" : ""}" data-act="firing-toggle" data-id="${esc(p.id)}">${img(coverOf(p), "thumb")}<div class="card-body"><div class="card-title">${esc(pieceName(p))}</div><div class="meta">${t("stage." + stageOf(p))}</div></div><i class="check">${on ? "✓" : ""}</i></button>`; }).join("") || empty(t("empty.pieces"))}</div>
      <button class="btn primary wide" data-act="sheet-close">${t("btn.done")}</button>`;
  }
};

// ---------- editing
function recOf(el) {
  const box = el.closest("[data-rec]");
  return box ? DB[box.dataset.coll][box.dataset.id] : null;
}
function changed(rec, redraw) {
  touch(rec); save();
  if (redraw) render(true); else updateCalcs(rec);
}

document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.dataset.search !== undefined) {
    const q = el.value.trim().toLowerCase();
    $$("[data-hay]").forEach((c) => { c.hidden = q && !c.dataset.hay.includes(q); });
    return;
  }
  if (!el.dataset.f || el.tagName === "SELECT") return;
  const rec = recOf(el);
  if (!rec) return;
  let v = el.value;
  if (el.dataset.num !== undefined) v = num(v);
  if (el.dataset.scale && v != null) v = Math.round(v * Number(el.dataset.scale) * 1000) / 1000;
  if (el.dataset.f === "sale.channel") v = channelKey(v);
  setPath(rec, el.dataset.f, v);
  changed(rec, false);
});
/** Typed channel text back to a built-in key when it matches one ("小红书" -> "xhs"). */
function channelKey(text) {
  const s = String(text).trim();
  for (const k of listValues("channels")) if (label("chan", k) === s) return k;
  return s;
}

document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.upload) return onUpload(el);
  if (el.dataset.import !== undefined) return onImport(el);
  if (el.dataset.setting === "glazeCoverage") { SETTINGS.glazeCoverage = num(el.value); saveSettings(); render(true); return; }
  if (el.dataset.setting) { SETTINGS[el.dataset.setting] = el.value.trim() || (el.dataset.setting === "currency" ? "£" : "cm"); saveSettings(); return; }
  if (el.dataset.gf) { SETTINGS.galleryFilters[el.dataset.gf] = el.value || null; saveSettings(); render(true); return; }
  if (el.dataset.ph) { const { rec, ph } = sheetPhoto(); if (ph) { ph[el.dataset.ph] = el.value; changed(rec, false); } return; }
  if (el.dataset.actChange === "design-link") {
    const p = DB.pieces[el.value], d = DB.designs[ROUTE.id];
    if (p && d) { p.designId = d.id; touch(p); if (d.status !== "completed") { d.status = "completed"; } changed(d, true); }
    return;
  }
  if (el.tagName !== "SELECT" || !el.dataset.f) return;
  const rec = recOf(el);
  if (!rec) return;
  let v = el.value;
  if (v === "__new__" && el.dataset.list) {
    const name = prompt(el.dataset.list === "glazes" ? t("addGlaze") : (LANG === "zh" ? "新泥料名称" : "New clay type"));
    if (!name || !name.trim()) { el.value = getPath(rec, el.dataset.f) || ""; return; }
    listAdd(el.dataset.list, name); v = name.trim();
  } else if (v === "__new__" && el.dataset.firingType) {
    const f = newRecord("firings", { date: today(), type: el.dataset.firingType });
    v = f.id;
    toast(LANG === "zh" ? "已新建烧制，点 › 填写详情" : "New firing created. Tap › to fill it in");
  }
  setPath(rec, el.dataset.f, v || null);
  changed(rec, true);
});

document.addEventListener("toggle", (e) => {
  const d = e.target;
  if (d.dataset && d.dataset.sec) { if (d.open) OPEN.add(d.dataset.sec); else OPEN.delete(d.dataset.sec); }
}, true);

document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]");
  if (!el || !el.dataset.act) return;
  const act = el.dataset.act;
  const rec = recOf(el);
  switch (act) {
    case "chip": return onChip(el, rec);
    case "list-add": {
      e.preventDefault();
      const name = el.dataset.list;
      const v = prompt(name === "glazes" ? t("addGlaze") : name === "tags" ? t("addTag") : "+");
      if (!v || !v.trim()) return;
      listAdd(name, v);
      const group = el.dataset.group;
      if (group && group.startsWith("ph.")) { const { rec: r, ph } = sheetPhoto(); ph.tags = [...new Set([...(ph.tags || []), v.trim()])]; touch(r); save(); drawSheet(); return; }
      if (group && rec && ["studio", "store"].includes(group)) { setPath(rec, group, v.trim()); touch(rec); }
      else if (group && rec) { const cur = getPath(rec, group) || []; setPath(rec, group, [...new Set([...cur, v.trim()])]); touch(rec); }
      save(); render(true); return;
    }
    case "list-remove": listRemove(el.dataset.list, el.dataset.val); save(); render(true); return;
    case "new-piece": { const p = newRecord("pieces", { started: today(), unit: SETTINGS.unit }); save(); go("#/piece/" + p.id); return; }
    case "new-drop": {
      const last = tripsSorted()[0], studio = (last && last.studio) || listValues("studios")[0] || "";
      const cone = {}; for (const ty of TRIP_TYPES) cone[ty] = conesUsed(ty)[0] || "";   // the usual cones, ready to change
      const tr = newRecord("trips", { kind: "drop", date: today(), studio, cone, items: [] });
      save(); go("#/trip/" + tr.id); return;
    }
    case "new-collect": {
      const waiting = atStudio(), where = [...new Set(waiting.map((w) => w.drop.studio))];
      const tr = newRecord("trips", { kind: "collect", date: today(), studio: where.length === 1 ? where[0] : ((tripsSorted()[0] || {}).studio || ""), items: [] });
      save(); go("#/trip/" + tr.id);
      if (waiting.length) setTimeout(() => openSheet({ kind: "pickCollect", id: tr.id }), 60);
      return;
    }
    case "trip-pick": openSheet({ kind: "pickDrop", id: rec.id, type: el.dataset.val }); return;
    case "trip-pick-collect": openSheet({ kind: "pickCollect", id: rec.id }); return;
    case "drop-toggle": {   // a piece goes for one firing per drop-off: ticking it here moves it from the other group
      const tr = DB.trips[SHEET.id], id = el.dataset.id, ty = SHEET.type;
      const was = (tr.items || []).find((x) => x.pieceId === id);
      tr.items = (tr.items || []).filter((x) => x.pieceId !== id);
      if (!was || (was.firing === "glaze" ? "glaze" : "bisque") !== ty) tr.items.push({ pieceId: id, firing: ty });
      touch(tr); save(); drawSheet(); return;
    }
    case "collect-toggle": {
      const tr = DB.trips[SHEET.id], id = el.dataset.id, did = el.dataset.drop;
      const on = (tr.items || []).some((x) => x.pieceId === id && x.dropId === did);
      if (on) tr.items = tr.items.filter((x) => !(x.pieceId === id && x.dropId === did));
      else { const d = DB.trips[did], it = d && (d.items || []).find((x) => x.pieceId === id); tr.items = [...(tr.items || []), { pieceId: id, firing: it ? it.firing : "bisque", dropId: did }]; }
      touch(tr); save(); drawSheet(); return;
    }
    case "collect-all": {
      const tr = DB.trips[SHEET.id];
      for (const w of atStudio(tr.studio || null)) tr.items = [...(tr.items || []), { pieceId: w.p.id, firing: w.item.firing, dropId: w.drop.id }];
      touch(tr); save(); drawSheet(); return;
    }
    case "trip-unlink": e.preventDefault(); rec.items = (rec.items || []).filter((x) => x.pieceId !== el.dataset.id); changed(rec, true); return;
    case "cone-pick": rec.cone = Object.assign({}, rec.cone, { [el.dataset.type]: el.dataset.val }); changed(rec, true); return;
    case "studio-open": {
      const name = el.dataset.val;
      const st = studioOf(name) || newRecord("studios", { name, bisque: { by: "kg" }, glaze: { by: "kg" } });
      save(); go("#/studio/" + st.id); return;
    }
    case "new-firing": { const f = newRecord("firings", { date: today(), type: "bisque" }); save(); go("#/firing/" + f.id); return; }
    case "new-design": { const d = newRecord("designs", { status: "concept" }); save(); go("#/design/" + d.id); return; }
    case "new-insp": { const x = newRecord("insps", { tags: [] }); save(); go("#/insp/" + x.id); return; }
    case "design-from-insp": { const d = newRecord("designs", { status: "concept", inspId: ROUTE.id }); save(); go("#/design/" + d.id); return; }
    case "swipe-delete": return deleteRecord(el.dataset.coll, el.dataset.id);
    case "piece-filter": PIECE_FILTER = el.dataset.val; render(true); return;
    case "piece-tag": PIECE_TAG = PIECE_TAG === el.dataset.val ? null : el.dataset.val; render(true); return;
    case "piece-tab": PIECE_TAB = el.dataset.val; render(); window.scrollTo(0, 0); return;
    case "to-glaze": { const id = ROUTE.id; PIECE_TAB_FOR = id; PIECE_TAB = "glaze"; return; }   // the link carries on to the piece
    case "costs-tab": COSTS_TAB = el.dataset.val; render(); window.scrollTo(0, 0); return;
    case "fire-where": FIRE_WHERE = el.dataset.val; render(true); return;
    case "new-purchase": {   // most orders repeat the last one, so start from a copy of it
      const last = lastOrder();
      const b = newRecord("purchases", Object.assign({ date: today(), items: [{ kind: "clay" }] }, last ? orderCopy(last) : {}));
      save(); go("#/purchase/" + b.id);
      if (last) toast(t("buy.copied", { shop: last.store ? label("store", last.store) : dateText(last.date) }));
      return;
    }
    case "item-add": rec.items = [...(rec.items || []), { kind: (rec.items || []).length ? rec.items[rec.items.length - 1].kind : "clay" }]; changed(rec, true); return;
    case "item-del": rec.items.splice(Number(el.dataset.i), 1); changed(rec, true); return;
    case "shape": rec.shape = el.dataset.val; changed(rec, true); return;
    case "shape-new": {
      const name = prompt(t("shape.askName"));
      if (!name || !name.trim()) return;
      const fields = prompt(t("shape.askFields"), t("dim.l") + ", " + t("dim.w") + ", " + t("dim.h"));
      if (!fields || !fields.trim()) return;
      const sh = newRecord("shapes", { name: name.trim(), fields: fields.split(/[,，]/).map((x) => x.trim()).filter(Boolean) });
      rec.shape = sh.id; changed(rec, true); return;
    }
    case "ideas-tab": SETTINGS.ideasTab = el.dataset.val; saveSettings(); render(); return;
    case "ideas-open": SETTINGS.ideasTab = el.dataset.val; saveSettings(); return;   // the link carries on to #/ideas
    case "piece-view": {   // photos → photos with names → list → back
      const order = ["grid", "titles", "list"];
      SETTINGS.pieceView = order[(order.indexOf(SETTINGS.pieceView) + 1) % order.length] || "titles";
      saveSettings(); render(true); return;
    }
    case "clay-add": rec.clay = [...(rec.clay || []), { type: (rec.clay && rec.clay.length) ? "" : (listValues("clay")[0] || ""), g: null }]; changed(rec, true); return;
    case "clay-del": rec.clay.splice(Number(el.dataset.i), 1); changed(rec, true); return;
    case "delete": return deleteRecord(el.dataset.coll, rec.id, true);
    case "photo": {
      const pid = el.dataset.pid;
      if (!pid) return;
      const owner = el.dataset.owner || (rec && rec.id);
      openSheet({ kind: "photo", coll: "pieces", id: owner, pid }); return;
    }
    case "sheet-close": closeSheet(); render(true); return;
    case "ph-cover": {
      const { rec: r, ph } = sheetPhoto(); r.cover = ph.id; touch(r); save();
      if (SHEET.kind === "photoMenu") { closeSheet(); render(true); } else drawSheet();
      return;
    }
    case "menu-delete": { const { coll, id } = SHEET; closeSheet(); return deleteRecord(coll, id); }
    case "ph-delete": {
      if (!confirm(t("confirm.deletePhoto"))) return;
      const { rec: r, ph } = sheetPhoto();
      r.photos = r.photos.filter((x) => x.id !== ph.id);
      if (r.cover === ph.id) r.cover = null;
      Photos.forget([ph]); touch(r); save(); closeSheet(); render(true); return;
    }
    case "image-del": { if (!confirm(t("confirm.deletePhoto"))) return; Photos.forget([rec.image]); rec.image = null; changed(rec, true); return; }
    case "insp-pick": openSheet({ kind: "pickInsp", id: rec.id }); return;
    case "insp-toggle": {
      const p = DB.pieces[SHEET.id], id = el.dataset.id, cur = p.inspIds || [];
      p.inspIds = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      touch(p); save(); drawSheet(); return;
    }
    case "insp-unlink": e.preventDefault(); rec.inspIds = (rec.inspIds || []).filter((x) => x !== el.dataset.id); changed(rec, true); return;
    case "firing-pick": openSheet({ kind: "pickPieces", id: rec.id }); return;
    case "firing-toggle": {
      const f = DB.firings[SHEET.id], p = DB.pieces[el.dataset.id];
      const key = f.type === "bisque" ? "bisque" : "glaze";
      p[key] = p[key] || {};
      p[key].firingId = p[key].firingId === f.id ? null : f.id;
      touch(p); save(); drawSheet(); return;
    }
    case "firing-unlink": {
      e.preventDefault();
      const p = DB.pieces[el.dataset.id];
      for (const k of ["bisque", "glaze"]) if (p[k] && p[k].firingId === rec.id) p[k].firingId = null;
      touch(p); save(); render(true); return;
    }
    case "lang": SETTINGS.lang = el.dataset.val; saveSettings(); setLang(SETTINGS.lang); render(true); return;
    case "sync": Sync.run(); return;
    case "sign-in": case "sign-up": case "forgot": return onAuth(e, act);
    case "sign-out": await cloud.signOut(); Sync.reset(); render(true); return;
    case "export": return onExport();
    case "restore": {
      const b = BACKUPS[Number(el.dataset.i)];
      if (!b || !confirm(t("set.restoreAsk", { when: dateText(new Date(b.at).toISOString().slice(0, 10), true) }))) return;
      const n = Backups.restore(b.data);
      render(true); toast(t("set.restored", { n }));
      return;
    }
    case "force-update": return forceUpdate(el);
  }
});

/* Swipe a row left to uncover its Delete button; a tap anywhere else puts it back.
 * Rows only follow horizontal drags, so scrolling the list still works normally. */
const SWIPE_W = 92;
let swipeOpen = null, swipeBox = null, swipeX = 0, swipeY = 0, swipeDir = null, swipeAt = 0;
function closeSwipe() {
  if (swipeOpen) { swipeOpen.classList.remove("open"); swipeOpen.querySelector(".card").style.transform = ""; swipeOpen = null; }
}
document.addEventListener("touchstart", (e) => {
  const box = e.target.closest(".swipe");
  if (swipeOpen && swipeOpen !== box) closeSwipe();
  if (!box || e.touches.length !== 1) return;
  swipeBox = box; swipeX = e.touches[0].clientX; swipeY = e.touches[0].clientY; swipeDir = null;
  swipeAt = box.classList.contains("open") ? -SWIPE_W : 0;
}, { passive: true });
document.addEventListener("touchmove", (e) => {
  if (!swipeBox || e.touches.length !== 1) return;
  const dx = e.touches[0].clientX - swipeX, dy = e.touches[0].clientY - swipeY;
  if (!swipeDir) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    swipeDir = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (swipeDir === "x") swipeBox.classList.add("dragging");
  }
  if (swipeDir !== "x") return;
  const start = swipeBox.classList.contains("open") ? -SWIPE_W : 0;
  swipeAt = Math.max(-SWIPE_W - 20, Math.min(0, start + dx));
  swipeBox.querySelector(".card").style.transform = `translateX(${swipeAt}px)`;
}, { passive: true });
document.addEventListener("touchend", () => {
  if (!swipeBox) return;
  const box = swipeBox; swipeBox = null;
  box.classList.remove("dragging");
  box.querySelector(".card").style.transform = "";
  if (swipeDir !== "x") return;
  const wasOpen = box === swipeOpen;
  closeSwipe();
  if (swipeAt <= -SWIPE_W / 2 || (wasOpen && swipeAt < -SWIPE_W / 2)) { box.classList.add("open"); swipeOpen = box; }
}, { passive: true });
/* A tap on an open row closes it instead of opening the piece. */
document.addEventListener("click", (e) => {
  if (heldJustNow && Date.now() - heldJustNow < 600) { e.preventDefault(); e.stopPropagation(); return; }
  if (!swipeOpen) return;
  if (e.target.closest(".swipe-del")) return;
  if (e.target.closest(".swipe") === swipeOpen) { e.preventDefault(); e.stopPropagation(); }
  closeSwipe();
}, true);

/* Hold a tag, glaze, clay, studio or one of your own shapes for half a second to remove it.
 * Built-in shapes and anything already typed into a piece stay where they are. */
let pressTimer = null, pressedChip = null, heldJustNow = 0;
function longPress(el) {
  pressedChip = null;
  if (el.dataset.hold) {
    const [coll, id] = el.dataset.hold.split(":");
    if (coll === "photo") openSheet({ kind: "photoMenu", coll: "pieces", id: ROUTE.id, pid: id });
    else if (DB[coll] && DB[coll][id]) openSheet({ kind: "recordMenu", coll, id });
    return;
  }
  const rec = recOf(el);
  if (el.dataset.act === "shape") {
    const sh = DB.shapes[el.dataset.val];
    if (!sh) return;   // a built-in shape
    if (!confirm(t("confirm.removeShape", { name: sh.name }))) return;
    for (const p of Object.values(DB.pieces)) if (p.shape === sh.id) { p.shape = "box"; touch(p); }
    removeRecord("shapes", sh.id); save(); render(true); return;
  }
  const list = el.dataset.from, val = el.dataset.val;
  if (!list || !val) return;
  if (!confirm(t("confirm.removeTag", { name: el.textContent.trim() }))) return;
  listRemove(list, val);
  if (rec) {   // and untick it here, so the piece doesn't keep a tag you just retired
    const cur = getPath(rec, el.dataset.group);
    if (Array.isArray(cur)) setPath(rec, el.dataset.group, cur.filter((x) => x !== val));
    else if (cur === val) setPath(rec, el.dataset.group, null);
    touch(rec);
  }
  save(); render(true);
}
document.addEventListener("touchstart", (e) => {
  const el = e.target.closest(".chip[data-from], .chip[data-act='shape'], [data-hold]");
  clearTimeout(pressTimer);
  if (!el) return;
  pressedChip = el;
  pressTimer = setTimeout(() => { if (pressedChip === el) { heldJustNow = Date.now(); navigator.vibrate && navigator.vibrate(12); longPress(el); } }, 550);
}, { passive: true });
["touchend", "touchmove", "touchcancel", "scroll"].forEach((ev) => document.addEventListener(ev, () => { clearTimeout(pressTimer); pressedChip = null; }, { passive: true }));
document.addEventListener("contextmenu", (e) => {   // right-click on a computer, and the iOS hold menu
  const el = e.target.closest(".chip[data-from], .chip[data-act='shape'], [data-hold]");
  if (!el) return;
  e.preventDefault();
  if (!("ontouchstart" in window)) longPress(el);
});

/** Delete anything, from its own page or from a swiped row, tidying up what referred to it. */
function deleteRecord(coll, id, fromPage) {
  const rec = DB[coll] && DB[coll][id];
  if (!rec) { closeSwipe(); return; }
  const what = { pieces: "confirm.deletePiece", firings: "confirm.deleteFiring", designs: "confirm.deleteDesign", insps: "confirm.deleteInsp", purchases: "confirm.deletePurchase", shapes: "confirm.removeShape", trips: "confirm.deleteTrip" }[coll];
  const name = coll === "pieces" ? pieceName(rec) : coll === "designs" ? designName(rec) : coll === "insps" ? inspName(rec) : coll === "firings" ? firingName(rec) : coll === "trips" ? tripName(rec) : "";
  if (!confirm(name ? `${t(what)}\n\n${name}` : t(what))) { closeSwipe(); return; }
  if (coll === "firings") for (const p of piecesInFiring(id)) { for (const k of ["bisque", "glaze"]) if (p[k] && p[k].firingId === id) p[k].firingId = null; touch(p); }
  if (coll === "designs") for (const p of Object.values(DB.pieces)) if (p.designId === id) { p.designId = null; touch(p); }
  if (coll === "pieces" || coll === "trips") for (const tr of Object.values(DB.trips)) {   // a deleted piece leaves its trips; a deleted drop-off un-collects its pieces
    const keep = (tr.items || []).filter((x) => coll === "pieces" ? x.pieceId !== id : x.dropId !== id);
    if (keep.length !== (tr.items || []).length) { tr.items = keep; touch(tr); }
  }
  if (coll === "insps") {
    for (const p of Object.values(DB.pieces)) if ((p.inspIds || []).includes(id)) { p.inspIds = p.inspIds.filter((x) => x !== id); touch(p); }
    for (const d of Object.values(DB.designs)) if (d.inspId === id) { d.inspId = null; touch(d); }
  }
  removeRecord(coll, id); save(); closeSwipe();
  if (fromPage) location.replace("#/" + (TAB_OF[ROUTE.name] || "pieces")); else render(true);
}

function onChip(el, rec) {
  const group = el.dataset.group, val = el.dataset.val, single = el.dataset.single !== undefined;
  if (group === "addStage") { ROUTE.addStage = val; $$(`[data-group="addStage"]`).forEach((b) => b.setAttribute("aria-pressed", b.dataset.val === val)); return; }
  if (group === "clayBasis") { SETTINGS.clayBasis = val; saveSettings(); render(true); return; }
  if (group.startsWith("gf.")) {
    const k = group.slice(3), F = SETTINGS.galleryFilters;
    F[k] = F[k] === val ? null : val; saveSettings(); render(true); return;
  }
  if (group.startsWith("ph.")) {
    const { rec: r, ph } = sheetPhoto(), k = group.slice(3);
    if (single) ph[k] = val; else { const cur = ph[k] || []; ph[k] = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val]; }
    touch(r); save(); drawSheet(); return;
  }
  if (!rec) return;
  const cur = getPath(rec, group);
  if (single) setPath(rec, group, cur === val && !["sale.status", "status", "type", "where", "split"].includes(group) && !group.endsWith(".by") ? null : val);
  else { const arr = Array.isArray(cur) ? cur : []; setPath(rec, group, arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]); }
  if (group === "sale.status" && val === "sold" && !rec.sale.soldDate) rec.sale.soldDate = today();
  if (group === "store" && rec.store === val && ROUTE.name === "purchase") {   // picking a shop brings in what's usually bought there
    const last = lastOrder(val, rec.id);
    const blank = !(rec.items || []).some((x) => x && (x.name || has(x.grams) || has(x.cost)));
    if (last && (blank || orderCopied(rec))) { Object.assign(rec, orderCopy(last)); toast(t("buy.copied", { shop: label("store", val) })); }
  }
  changed(rec, true);
}

async function onUpload(input) {
  const files = Array.from(input.files || []);
  input.value = "";
  if (!files.length) return;
  const target = input.dataset.upload;
  try {
    if (target === "replace") {   // same place in the list, same stage and tags, cover stays the cover
      const { rec: r0, ph: old } = sheetPhoto();
      if (!old) return;
      const ph = await Photos.fromFile(files[0], { stage: old.stage, tags: [...(old.tags || [])] });
      if (old.at) ph.at = old.at;
      const r = DB.pieces[r0.id] || r0;
      r.photos = (r.photos || []).map((x) => x.id === old.id ? ph : x);
      if (r.cover === old.id) r.cover = ph.id;
      Photos.forget([old]); touch(r); save(); closeSheet(); render(true);
      toast(t("photo.replaced"));
      return;
    }
    if (target === "newpiece" || target === "piece") {
      let p = target === "piece" ? DB.pieces[ROUTE.id] : newRecord("pieces", { started: today(), unit: SETTINGS.unit });
      const stage = target === "newpiece" ? "wet" : (ROUTE.addStage || stageOf(p));
      for (const f of files) {
        const ph = await Photos.fromFile(f, { stage, tags: [...(p.tags || [])] });
        p = DB.pieces[p.id] || p;   // a sync may have swapped the object while the photo was being saved
        p.photos = [...(p.photos || []), ph];
        if (!p.cover || stage === "glazed") p.cover = ph.id;
      }
      DB.pieces[p.id] = p;
      touch(p); save();
      if (target === "newpiece") go("#/piece/" + p.id); else render(true);
      return;
    }
    const coll = { design: "designs", insp: "insps", newinsp: "insps" }[target];
    let rec = target === "newinsp" ? newRecord("insps", { tags: [] }) : DB[coll][ROUTE.id];
    const ph = await Photos.fromFile(files[0], { stage: coll === "designs" ? "design" : "insp" });
    rec = DB[coll][rec.id] || rec;
    if (rec.image) Photos.forget([rec.image]);
    rec.image = ph;
    DB[coll][rec.id] = rec;
    touch(rec); save();
    if (target === "newinsp") go("#/insp/" + rec.id); else render(true);
  } catch (err) {
    toast(err.message || String(err));
  }
}

async function onAuth(e, act) {
  e.preventDefault();
  const form = $("#auth");
  const email = form.email.value.trim(), password = form.password.value;
  try {
    if (act === "forgot") { if (!email) return form.email.focus(); await cloud.resetPassword(email); toast(t("set.resetSent")); return; }
    if (!email || password.length < 6) { form.reportValidity(); return; }
    if (act === "sign-in") await cloud.signIn(email, password);
    else if (!(await cloud.signUp(email, password))) { toast(t("set.checkEmail")); return; }
    Sync.reset(); render(true); Sync.run();
  } catch (err) { toast(cloud.explain(err)); }
}

/** Throw away the cached app (never the data: records and photos live in localStorage and
 * IndexedDB, which this doesn't touch) and load everything fresh from the server. */
async function forceUpdate(btn) {
  btn.disabled = true; btn.textContent = t("set.updating");
  persist();
  try {
    if ("serviceWorker" in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
    await Promise.all(APP_FILES.map((f) => fetch(f, { cache: "reload" }).catch(() => {})));   // refresh the browser's own copy too
  } catch (e) {}
  location.replace(location.pathname + "?u=" + now() + location.hash);
}

function onExport() {
  const blob = new Blob([JSON.stringify(DB, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `clay-journal-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function onImport(input) {
  const f = input.files && input.files[0];
  input.value = "";
  if (!f) return;
  try { DB = merge(DB, JSON.parse(await f.text())); save(); render(true); toast(t("set.imported")); }
  catch (err) { toast(err.message); }
}

// ---------- start
const APP_VERSION = "26";
setLang(SETTINGS.lang);
$("#back").addEventListener("click", () => { if (history.length > 1) history.back(); else go("#/" + (TAB_OF[ROUTE.name] || "pieces")); });
$("#gear").addEventListener("click", () => { if (ROUTE.name === "more") history.back(); else go("#/more"); });
$("#lang").addEventListener("click", () => { SETTINGS.lang = LANG === "zh" ? "en" : "zh"; saveSettings(); setLang(SETTINGS.lang); render(true); if (SHEET) drawSheet(); });
$("#tabs").innerHTML = TABS.map((k) => `<a href="#/${k}" data-tab="${k}">${ICON[k]}</a>`).join("");
Sync.onChange(paintSync);
if (window.cloud) cloud.onAuth(() => paintSync());
ROUTE = parseRoute();
render();
Backups.rescue().then((saved) => { if (saved) { render(true); toast(t("set.rescued")); } });
if (/[?&]u=/.test(location.search)) {   // just back from Force update: tidy the address and say so
  history.replaceState(null, "", location.pathname + location.hash);
  toast(`${t("set.updated")} · v${APP_VERSION}`);
}
Sync.run();
setInterval(() => { if (document.visibilityState === "visible") Sync.run(); }, 5 * 60000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") Sync.run(); });
// ---------- no zooming: iOS ignores user-scalable=no, so stop pinch gestures here too
["gesturestart", "gesturechange", "gestureend"].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
document.addEventListener("touchmove", (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

// ---------- always the latest version
// The service worker fetches fresh files on every open. A home-screen app often isn't opened
// fresh though, just brought back from the background, so on return we compare the server's
// file fingerprints with the ones we started with and reload if anything was published.
const APP_FILES = ["index.html", "app.js", "store.js", "i18n.js", "cloud.js", "styles.css", "sw.js"];
async function fingerprint() {
  const tags = await Promise.all(APP_FILES.map((f) => fetch(f, { method: "HEAD", cache: "no-store" })
    .then((r) => r.ok ? (r.headers.get("etag") || r.headers.get("last-modified") || "") : "").catch(() => null)));
  return tags.includes(null) ? null : tags.join("|");   // null: offline, can't tell
}
let startPrint = null, hiddenAt = 0;
const canUpdate = location.protocol === "https:" || location.hostname === "localhost";
if ("serviceWorker" in navigator && canUpdate) {
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {});
  fingerprint().then((f) => { startPrint = f; });
}
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "hidden") { hiddenAt = now(); return; }
  if (!canUpdate || now() - hiddenAt < 15000) return;
  navigator.serviceWorker && navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {});
  const f = await fingerprint();
  if (!f) return;
  if (!startPrint) { startPrint = f; return; }
  if (f !== startPrint) { persist(); location.reload(); }
});
