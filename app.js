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
const money = (n) => has(n) ? `${SETTINGS.currency}${fmt(n, 2)}` : "";

const TECHNIQUES = ["wheel", "hand", "coil", "slab", "pinch", "marbled"];
const STAGES = ["wet", "bisque", "glazed", "final"];
const METHODS = ["dip", "spray", "brush"];
const OUTCOMES = ["success", "partial", "failed"];
const DEFECTS = ["crack", "warp", "crawl", "pinhole", "color", "other"];
const SALES = ["not", "for", "sold"];
const FTYPES = ["bisque", "glaze", "wood", "raku", "other"];
const DSTATUS = ["concept", "attempted", "completed"];
const UNITS = ["cm", "mm", "in"];

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
  if (any(p.bisque, ["l", "w", "h", "weight", "firingId"])) i = 1;
  if (any(p.glaze, ["glazes", "method", "firingId"])) i = 2;
  if (any(p.final, ["l", "w", "h", "weight", "outcome"])) i = 3;
  for (const ph of p.photos || []) i = Math.max(i, STAGES.indexOf(ph.stage));
  return STAGES[i];
}
function shrink(from, to) {
  if (!from || !to) return null;
  const out = {}, vals = [];
  for (const k of ["l", "w", "h"]) {
    if (has(from[k]) && has(to[k]) && from[k] > 0) { out[k] = (from[k] - to[k]) / from[k] * 100; vals.push(out[k]); }
  }
  if (!vals.length) return null;
  out.avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return out;
}
function calc(p) {
  const total = (p.clay || []).reduce((a, r) => a + (has(r.g) ? Number(r.g) : 0), 0);
  const w = p.wet || {};
  return {
    total: total ? `${fmt(total, 0)} g` : "–",
    trimmed: has(w.weight) && has(w.trimmed) ? `${fmt(w.weight - w.trimmed, 0)} g (${fmt((w.weight - w.trimmed) / w.weight * 100)}%)` : "–",
    shrinkB: shrinkText(shrink(p.wet, p.bisque)),
    shrinkF: shrinkText(shrink(p.wet, p.final)),
    shrinkBavg: avgText(shrink(p.wet, p.bisque)),
    shrinkFavg: avgText(shrink(p.wet, p.final)),
    stage: t("stage." + stageOf(p))
  };
}
function shrinkText(s) {
  if (!s) return "–";
  const parts = ["l", "w", "h"].filter((k) => has(s[k])).map((k) => `${t("f." + { l: "length", w: "width", h: "height" }[k])} ${fmt(s[k])}%`);
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
  return `<div class="chips">${values.map((v) => `<button type="button" class="chip${opts.cls ? " " + opts.cls + "-" + esc(v) : ""}" data-act="chip" data-group="${esc(group)}" data-val="${esc(v)}"${opts.single ? " data-single" : ""} aria-pressed="${sel.includes(v)}">${esc(labelFn(v))}</button>`).join("")}${opts.add ? `<button type="button" class="chip add" data-act="list-add" data-list="${opts.add}" data-group="${esc(group)}">+</button>` : ""}</div>`;
}
function field(lbl, inner, cls = "") { return `<label class="field ${cls}"><span>${esc(lbl)}</span>${inner}</label>`; }
function numIn(path, val, ph = "") { return `<input type="number" inputmode="decimal" step="any" data-f="${path}" data-num value="${has(val) ? esc(val) : ""}" placeholder="${esc(ph)}">`; }
function textIn(path, val, ph = "", list = "") { return `<input type="text" data-f="${path}" value="${esc(val || "")}" placeholder="${esc(ph)}"${list ? ` list="${list}"` : ""}>`; }
function dateIn(path, val) { return `<input type="date" data-f="${path}" value="${esc(val || "")}">`; }
function area(path, val, ph = "") { return `<textarea data-f="${path}" rows="3" placeholder="${esc(ph)}">${esc(val || "")}</textarea>`; }
function dims(prefix, o, unit) {
  o = o || {};
  return `<div class="dims">${["l", "w", "h"].map((k) => `<label><span>${t("f." + { l: "length", w: "width", h: "height" }[k])}</span>${numIn(`${prefix}.${k}`, o[k], unit)}</label>`).join("")}</div>`;
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
function empty(text) { return `<p class="empty">${esc(text)}</p>`; }

const ICON = {
  pieces: '<svg viewBox="0 0 24 24"><path d="M7 4h10l-1 3c2 2 3 5 3 8a7 7 0 0 1-14 0c0-3 1-6 3-8z"/></svg>',
  gallery: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>',
  firings: '<svg viewBox="0 0 24 24"><path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/></svg>',
  ideas: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c1 1 1.5 2 1.5 3h5c0-1 .5-2 1.5-3A6 6 0 0 0 12 3z"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  filter: '<svg viewBox="0 0 24 24"><path d="M4 5h16l-6 8v5l-4 2v-7z"/></svg>'
};

// ---------- routing
let ROUTE = { name: "pieces" };
let OPEN = new Set();            // which piece-editor sections are expanded
let OPEN_FOR = null;             // ...and for which piece
let PIECE_FILTER = "all";
function parseRoute() {
  const [name, id] = location.hash.replace(/^#\/?/, "").split("/");
  return { name: name || "pieces", id: id ? decodeURIComponent(id) : null };
}
const go = (h) => { location.hash = h; };
window.addEventListener("hashchange", () => { ROUTE = parseRoute(); closeSheet(); render(); window.scrollTo(0, 0); });

const TABS = ["pieces", "gallery", "firings", "ideas", "settings"];
const TAB_OF = { piece: "pieces", firing: "firings", design: "ideas", insp: "ideas" };

// ---------- views
const VIEWS = {};

VIEWS.pieces = () => {
  const all = sortedPieces();
  const filters = ["all", ...STAGES, "for", "sold"];
  const shown = all.filter((p) => PIECE_FILTER === "all" ? true : STAGES.includes(PIECE_FILTER) ? stageOf(p) === PIECE_FILTER : (p.sale && p.sale.status) === PIECE_FILTER);
  const fl = (v) => v === "all" ? (LANG === "zh" ? "全部" : "All") : STAGES.includes(v) ? t("stage." + v) : t("sale." + v);
  return `
    ${all.length ? `<div class="toolbar"><input type="search" class="search" data-search placeholder="${t("search")}">
      <div class="chips scroll">${filters.map((v) => `<button class="chip" data-act="piece-filter" data-val="${v}" aria-pressed="${PIECE_FILTER === v}">${esc(fl(v))}</button>`).join("")}</div></div>` : ""}
    <div class="cards">${shown.map(pieceCard).join("") || empty(all.length ? t("empty.gallery") : t("empty.pieces"))}</div>
    <div class="fab">${`<label class="fab-cam" aria-label="${t("btn.takePhoto")}"><input type="file" accept="image/*" capture="environment" hidden data-upload="newpiece">${ICON.camera}</label>`}
      <button class="btn primary" data-act="new-piece">${ICON.plus} ${t("btn.newPiece")}</button></div>`;
};
function pieceCard(p) {
  const st = stageOf(p), s = p.sale || {};
  const hay = [p.title, p.notes, ...(p.tags || []).map((x) => label("tag", x)), ...(p.technique || []).map((x) => label("tech", x)), ...((p.glaze && p.glaze.glazes) || [])].join(" ").toLowerCase();
  return `<a class="card piece" href="#/piece/${esc(p.id)}" data-hay="${esc(hay)}">
    ${img(coverOf(p), "thumb")}
    <div class="card-body">
      <div class="card-title">${esc(pieceName(p))}</div>
      <div class="meta">${esc([dateText(p.started), ...(p.tags || []).map((x) => label("tag", x))].filter(Boolean).join(" · "))}</div>
      <div class="pills"><span class="pill st-${st}">${t("stage." + st)}</span>
        ${p.final && p.final.outcome ? `<span class="pill oc-${p.final.outcome}">${t("outcome." + p.final.outcome)}</span>` : ""}
        ${s.status === "for" ? `<span class="pill sale">${t("sale.for")}${has(s.ask) ? " " + money(s.ask) : ""}</span>` : ""}
        ${s.status === "sold" ? `<span class="pill sold">${t("sale.sold")}${has(s.price) || has(s.ask) ? " " + money(has(s.price) ? s.price : s.ask) : ""}</span>` : ""}</div>
    </div></a>`;
}

VIEWS.piece = (r) => {
  const p = DB.pieces[r.id];
  if (!p) return null;
  if (OPEN_FOR !== p.id) {   // first look at this piece: open what's relevant to where it's at
    OPEN_FOR = p.id;
    const st = stageOf(p);
    OPEN = new Set(["photos", { wet: "wet", bisque: "bisque", glazed: "glaze", final: "final" }[st]]);
    if (!p.title && !(p.technique || []).length) OPEN.add("basics");
    if (!(p.clay || []).length && st === "wet") OPEN.add("clay");
  }
  const c = calc(p), u = p.unit || SETTINGS.unit, st = stageOf(p);
  const addStage = r.addStage || st;
  const clayRows = (p.clay || []).map((row, i) => `<div class="clay-row">
      <select data-f="clay.${i}.type" data-list="clay"><option value="">${t("f.clayType")}</option>${[...new Set([...listValues("clay"), row.type].filter(Boolean))].map((v) => `<option value="${esc(v)}"${v === row.type ? " selected" : ""}>${esc(label("clay", v))}</option>`).join("")}<option value="__new__">+ …</option></select>
      <input type="number" inputmode="numeric" step="any" data-f="clay.${i}.g" data-num value="${has(row.g) ? esc(row.g) : ""}" placeholder="g">
      <button class="icon-btn" data-act="clay-del" data-i="${i}" aria-label="${t("btn.delete")}">${ICON.x}</button></div>`).join("");
  const s = p.sale || {};
  const fin = p.final || {};
  const photos = p.photos || [];
  const insps = (p.inspIds || []).map((id) => DB.insps[id]).filter(Boolean);
  const designs = Object.values(DB.designs).sort((a, b) => b.createdAt - a.createdAt);
  return `<div data-rec data-coll="pieces" data-id="${esc(p.id)}" class="editor">
    <div class="hero" data-act="${photos.length ? "photo" : ""}" data-pid="${esc((coverOf(p) || {}).id || "")}">${photos.length ? img(coverOf(p), "hero-img", false) : `<label class="hero-add"><input type="file" accept="image/*" capture="environment" hidden data-upload="piece">${ICON.camera}<span>${t("btn.takePhoto")}</span></label>`}</div>
    <input class="title-in" type="text" data-f="title" value="${esc(p.title || "")}" placeholder="${esc(t("untitled"))}">
    <div class="stages">${STAGES.map((x, i) => `<span class="${i <= STAGES.indexOf(st) ? "on" : ""}">${t("stage." + x)}</span>`).join("")}</div>

    ${section("photos", t("sec.photos"), `
      <div class="ph-grid">${photos.map((ph) => `<button class="ph" data-act="photo" data-pid="${esc(ph.id)}">${img(ph)}<span class="pill st-${ph.stage}">${t("stage." + ph.stage)}</span>${ph.id === p.cover ? '<i class="star">★</i>' : ""}${ph.url ? "" : '<i class="dot" title="not uploaded"></i>'}</button>`).join("")}</div>
      ${field(t("f.addStage"), chips("addStage", STAGES, addStage, (v) => t("stage." + v), { single: true }))}
      <div class="row">${uploadBtn("piece", true, t("btn.takePhoto"))}${uploadBtn("piece", false, t("btn.addPhoto"))}</div>`,
      photos.length ? t("photos.count", { n: photos.length }) : "")}

    ${section("basics", t("sec.basics"), `
      ${field(t("f.started"), dateIn("started", p.started))}
      ${field(t("f.technique"), chips("technique", TECHNIQUES, p.technique, (v) => t("tech." + v)))}
      ${field(t("f.tags"), chips("tags", [...new Set([...listValues("tags"), ...(p.tags || [])])], p.tags, (v) => label("tag", v), { add: "tags" }))}
      ${field(t("f.notes"), area("notes", p.notes))}`,
      esc((p.technique || []).map((x) => t("tech." + x)).join(", ")))}

    ${section("clay", t("sec.clay"), `
      ${clayRows}
      <button class="btn small" data-act="clay-add">${ICON.plus} ${t("btn.addRow")}</button>
      <div class="calc"><span>${t("f.totalClay")}</span><b data-calc="total">${c.total}</b></div>`,
      `<span data-calc="total">${c.total}</span>`)}

    ${section("wet", t("sec.wet"), `
      <div class="row between"><span class="lbl">${t("f.dims")}</span><select data-f="unit" class="unit">${UNITS.map((x) => `<option${x === u ? " selected" : ""}>${x}</option>`).join("")}</select></div>
      ${dims("wet", p.wet, u)}
      <div class="grid2">${field(t("f.weight"), numIn("wet.weight", (p.wet || {}).weight))}${field(t("f.weightTrimmed"), numIn("wet.trimmed", (p.wet || {}).trimmed))}</div>
      <div class="calc"><span>${t("f.trimmedOff")}</span><b data-calc="trimmed">${c.trimmed}</b></div>
      ${field(t("f.dryDays"), numIn("wet.dryDays", (p.wet || {}).dryDays))}
      ${field(t("f.dryNotes"), area("wet.dryNotes", (p.wet || {}).dryNotes))}`)}

    ${section("bisque", t("sec.bisque"), `
      <span class="lbl">${t("f.dimsBisque")}</span>
      ${dims("bisque", p.bisque, u)}
      <div class="calc"><span>${t("f.shrinkBisque")}</span><b data-calc="shrinkB">${c.shrinkB}</b></div>
      ${field(t("f.weightBisque"), numIn("bisque.weight", (p.bisque || {}).weight))}
      ${field(t("f.firing"), firingSelect("bisque.firingId", (p.bisque || {}).firingId, "bisque"))}`,
      `<span data-calc="shrinkBavg">${c.shrinkBavg === "–" ? "" : c.shrinkBavg}</span>`)}

    ${section("glaze", t("sec.glaze"), `
      ${field(t("f.glazes"), chips("glaze.glazes", [...new Set([...listValues("glazes"), ...((p.glaze && p.glaze.glazes) || [])])], (p.glaze || {}).glazes, (v) => v, { add: "glazes" }))}
      ${field(t("f.method"), chips("glaze.method", METHODS, (p.glaze || {}).method, (v) => t("method." + v)))}
      ${field(t("f.firing"), firingSelect("glaze.firingId", (p.glaze || {}).firingId, "glaze"))}`,
      esc(((p.glaze && p.glaze.glazes) || []).join(", ")))}

    ${section("final", t("sec.final"), `
      <span class="lbl">${t("f.dimsFinal")}</span>
      ${dims("final", p.final, u)}
      <div class="calc"><span>${t("f.shrinkFinal")}</span><b data-calc="shrinkF">${c.shrinkF}</b></div>
      ${field(t("f.weightFinal"), numIn("final.weight", fin.weight))}
      ${field(t("f.outcome"), chips("final.outcome", OUTCOMES, fin.outcome, (v) => t("outcome." + v), { single: true, cls: "oc" }))}
      ${fin.outcome && fin.outcome !== "success" ? field(t("f.defects"), chips("final.defects", DEFECTS, fin.defects, (v) => t("defect." + v))) : ""}
      ${fin.outcome && fin.outcome !== "success" && (fin.defects || []).includes("other") ? field(t("f.defectOther"), textIn("final.defectOther", fin.defectOther)) : ""}`,
      [fin.outcome ? t("outcome." + fin.outcome) : "", `<span data-calc="shrinkFavg">${c.shrinkFavg === "–" ? "" : c.shrinkFavg}</span>`].filter(Boolean).join(" · "))}

    ${section("links", t("sec.links"), `
      ${field(t("f.design"), `<div class="row"><select data-f="designId"><option value="">${t("none")}</option>${designs.map((d) => `<option value="${esc(d.id)}"${d.id === p.designId ? " selected" : ""}>${esc(designName(d))}</option>`).join("")}</select>${p.designId && DB.designs[p.designId] ? `<a class="btn small ghost" href="#/design/${esc(p.designId)}">›</a>` : ""}</div>`)}
      <span class="lbl">${t("f.inspirations")}</span>
      <div class="mini-grid">${insps.map((x) => `<div class="mini">${img(x.image)}<a href="#/insp/${esc(x.id)}" class="cover-link"></a><button class="icon-btn over" data-act="insp-unlink" data-id="${esc(x.id)}">${ICON.x}</button></div>`).join("")}
        <button class="mini add" data-act="insp-pick">${ICON.plus}</button></div>`)}

    ${section("sales", t("sec.sales"), `
      ${field(t("f.saleStatus"), chips("sale.status", SALES, s.status || "not", (v) => t("sale." + v), { single: true }))}
      <div class="grid2">${field(`${t("f.askPrice")} (${esc(SETTINGS.currency)})`, numIn("sale.ask", s.ask))}${s.status === "sold" ? field(`${t("f.salePrice")} (${esc(SETTINGS.currency)})`, numIn("sale.price", s.price)) : ""}</div>
      ${field(t("f.channel"), textIn("sale.channel", s.channel ? label("chan", s.channel) : "", "", "dl-channels"))}
      ${s.status === "sold" ? `<div class="grid2">${field(t("f.soldDate"), dateIn("sale.soldDate", s.soldDate))}${field(t("f.buyer"), textIn("sale.buyer", s.buyer))}</div>` : ""}`,
      s.status && s.status !== "not" ? t("sale." + s.status) : "")}

    <button class="btn danger wide" data-act="delete" data-coll="pieces">${t("btn.delete")}</button>
  </div>`;
};

VIEWS.gallery = () => {
  const F = SETTINGS.galleryFilters;
  const all = [];
  for (const p of Object.values(DB.pieces)) for (const ph of p.photos || []) all.push({ p, ph });
  const tagsIn = (x) => new Set([...(x.ph.tags || []), ...(x.p.tags || [])]);
  const shown = all.filter((x) =>
    (!F.tag || tagsIn(x).has(F.tag)) &&
    (!F.stage || x.ph.stage === F.stage) &&
    (!F.technique || (x.p.technique || []).includes(F.technique)) &&
    (!F.sale || ((x.p.sale && x.p.sale.status) || "not") === F.sale) &&
    (!F.outcome || (x.p.final && x.p.final.outcome) === F.outcome) &&
    (!F.from || (x.ph.at || "") >= F.from) && (!F.to || (x.ph.at || "") <= F.to)
  ).sort((a, b) => (b.ph.at || "").localeCompare(a.ph.at || ""));
  const active = Object.values(F).filter(Boolean).length;
  const usedTags = [...new Set(all.flatMap((x) => [...tagsIn(x)]))];
  const g = (key, vals, lab) => `<div class="fgroup"><span class="lbl">${t("filter." + key)}</span>${chips("gf." + key, vals, F[key], lab, { single: true })}</div>`;
  return `
    <div class="toolbar"><button class="btn small${active ? " primary" : ""}" data-act="toggle-filters">${ICON.filter} ${active ? active : ""}</button>
      <span class="meta">${t("photos.count", { n: shown.length })}</span>
      ${active ? `<button class="btn small ghost" data-act="clear-filters">${t("btn.clear")}</button>` : ""}</div>
    <div class="filters"${FILTERS_OPEN ? "" : " hidden"}>
      ${g("stage", STAGES, (v) => t("stage." + v))}
      ${usedTags.length ? g("tag", usedTags, (v) => label("tag", v)) : ""}
      ${g("technique", TECHNIQUES, (v) => t("tech." + v))}
      ${g("sale", SALES, (v) => t("sale." + v))}
      ${g("outcome", OUTCOMES, (v) => t("outcome." + v))}
      <div class="fgroup"><span class="lbl">${t("filter.date")}</span><div class="grid2">
        <label class="field"><span>${t("f.dateFrom")}</span><input type="date" data-gf="from" value="${esc(F.from || "")}"></label>
        <label class="field"><span>${t("f.dateTo")}</span><input type="date" data-gf="to" value="${esc(F.to || "")}"></label></div></div>
    </div>
    <div class="gallery">${shown.map((x) => `<button class="g-item" data-act="photo" data-owner="${esc(x.p.id)}" data-pid="${esc(x.ph.id)}">${img(x.ph)}<span class="pill st-${x.ph.stage}">${t("stage." + x.ph.stage)}</span></button>`).join("")}</div>
    ${shown.length ? "" : empty(t("empty.gallery"))}`;
};
let FILTERS_OPEN = false;

VIEWS.firings = () => {
  const fs = Object.values(DB.firings).sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.createdAt - a.createdAt);
  return `<div class="cards">${fs.map((f) => {
    const ps = piecesInFiring(f.id);
    return `<a class="card firing" href="#/firing/${esc(f.id)}">
      <div class="card-body"><div class="card-title">${esc(dateText(f.date, true))} · ${esc(label("ftype", f.type))}</div>
      <div class="meta">${esc([f.cone, f.kiln, t("pieces.count", { n: ps.length })].filter(Boolean).join(" · "))}</div></div>
      <div class="stack">${ps.slice(0, 4).map((p) => img(coverOf(p), "tiny")).join("")}</div></a>`;
  }).join("") || empty(t("empty.firings"))}</div>
  <div class="fab"><button class="btn primary" data-act="new-firing">${ICON.plus} ${t("btn.newFiring")}</button></div>`;
};

VIEWS.firing = (r) => {
  const f = DB.firings[r.id];
  if (!f) return null;
  const ps = piecesInFiring(f.id);
  const kilns = [...new Set(Object.values(DB.firings).map((x) => x.kiln).filter(Boolean))];
  return `<div data-rec data-coll="firings" data-id="${esc(f.id)}" class="editor pad">
    ${field(t("f.date"), dateIn("date", f.date))}
    ${field(t("f.firingType"), chips("type", FTYPES, f.type, (v) => t("ftype." + v), { single: true }))}
    <div class="grid2">${field(`${t("f.cone")} (${t("optional")})`, textIn("cone", f.cone, LANG === "zh" ? "6号锥 / 1230°C" : "Cone 6 / 1230°C"))}${field(t("f.kiln"), textIn("kiln", f.kiln, "", "dl-kilns"))}</div>
    <datalist id="dl-kilns">${kilns.map((k) => `<option value="${esc(k)}">`).join("")}</datalist>
    ${field(t("f.notes"), area("notes", f.notes, LANG === "zh" ? "升温曲线、保温、观察……" : "Schedule, ramp/hold, observations…"))}
    <div class="row between"><span class="lbl">${t("f.linked")} (${ps.length})</span><button class="btn small" data-act="firing-pick">${ICON.plus} ${t("btn.addPieces")}</button></div>
    <div class="cards">${ps.map((p) => `<div class="card piece slim"><a href="#/piece/${esc(p.id)}" class="cover-link"></a>${img(coverOf(p), "thumb")}<div class="card-body"><div class="card-title">${esc(pieceName(p))}</div><div class="meta">${t("stage." + stageOf(p))}</div></div><button class="icon-btn" data-act="firing-unlink" data-id="${esc(p.id)}">${ICON.x}</button></div>`).join("") || empty(t("empty.linked"))}</div>
    <button class="btn danger wide" data-act="delete" data-coll="firings">${t("btn.delete")}</button>
  </div>`;
};

function designName(d) { return (d.description || "").split("\n")[0].slice(0, 40) || `${t("ideas.designs")} · ${dateText(new Date(d.createdAt).toISOString().slice(0, 10))}`; }
VIEWS.ideas = () => {
  const tab = SETTINGS.ideasTab;
  const seg = `<div class="seg">${["designs", "insp"].map((x) => `<button data-act="ideas-tab" data-val="${x}" aria-pressed="${tab === x}">${t("ideas." + x)}</button>`).join("")}</div>`;
  if (tab === "designs") {
    const ds = Object.values(DB.designs).sort((a, b) => b.createdAt - a.createdAt);
    return `${seg}<div class="tiles">${ds.map((d) => `<a class="tile" href="#/design/${esc(d.id)}">${d.image ? img(d.image) : `<div class="tile-text">${esc(d.description || "")}</div>`}<span class="pill ds-${d.status || "concept"}">${t("dstatus." + (d.status || "concept"))}</span></a>`).join("")}</div>
      ${ds.length ? "" : empty(t("empty.designs"))}
      <div class="fab"><button class="btn primary" data-act="new-design">${ICON.plus} ${t("btn.newDesign")}</button></div>`;
  }
  const is = Object.values(DB.insps).sort((a, b) => b.createdAt - a.createdAt);
  return `${seg}<div class="tiles">${is.map((x) => `<a class="tile" href="#/insp/${esc(x.id)}">${x.image ? img(x.image) : `<div class="tile-text">${esc(x.notes || x.source || "")}</div>`}</a>`).join("")}</div>
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

VIEWS.settings = () => {
  const u = window.cloud && cloud.user;
  const pend = Photos.pending().length;
  const listEd = (name, lab, labFn) => `<div class="fgroup"><span class="lbl">${lab}</span><div class="chips">${listValues(name).map((v) => `<span class="chip on">${esc(labFn(v))}<button data-act="list-remove" data-list="${name}" data-val="${esc(v)}" aria-label="${t("btn.delete")}">×</button></span>`).join("")}<button class="chip add" data-act="list-add" data-list="${name}">+</button></div></div>`;
  return `<div class="pad settings">
    <h3>${t("set.language")}</h3>
    <div class="seg">${[["en", "English"], ["zh", "中文"]].map(([k, n]) => `<button data-act="lang" data-val="${k}" aria-pressed="${LANG === k}">${n}</button>`).join("")}</div>

    <h3>${t("set.account")}</h3>
    ${!window.cloud ? "<p class='meta'>Supabase isn't configured.</p>" : u ? `
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
      ${pend ? `<p class="meta">${t("sync.needSignIn")}</p>` : ""}`}

    <h3>${t("set.currency")} · ${t("set.unit")}</h3>
    <div class="grid2"><input type="text" data-setting="currency" value="${esc(SETTINGS.currency)}" maxlength="4">
      <select data-setting="unit">${UNITS.map((x) => `<option${x === SETTINGS.unit ? " selected" : ""}>${x}</option>`).join("")}</select></div>

    <h3>${t("set.lists")}</h3>
    ${listEd("tags", t("set.listTags"), (v) => label("tag", v))}
    ${listEd("clay", t("set.listClay"), (v) => label("clay", v))}
    ${listEd("glazes", t("set.listGlazes"), (v) => v)}
    ${listEd("channels", t("set.listChannels"), (v) => label("chan", v))}

    <h3>${t("set.backup")}</h3>
    <p class="meta">${t("set.stats", { p: Object.keys(DB.pieces).length, f: Object.keys(DB.firings).length, d: Object.keys(DB.designs).length, i: Object.keys(DB.insps).length })}</p>
    <div class="row"><button class="btn" data-act="export">${t("set.export")}</button>
      <label class="btn">${t("set.import")}<input type="file" accept="application/json,.json" hidden data-import></label></div>
    <p class="meta ver">v${APP_VERSION}</p>
  </div>`;
};
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
  document.title = t("app");
  $$("#tabs a").forEach((a) => { a.setAttribute("aria-current", a.dataset.tab === tab ? "page" : "false"); a.querySelector("span").textContent = t("tab." + a.dataset.tab); });
  paintSync();
  hydrate($("#main"));
  if (keepScroll) window.scrollTo(0, y);
}
function detailTitle() {
  const r = ROUTE;
  if (r.name === "piece") return pieceName(DB.pieces[r.id]);
  if (r.name === "firing") return label("ftype", DB.firings[r.id].type);
  if (r.name === "design") return t("ideas.designs");
  if (r.name === "insp") return t("ideas.insp");
  return "";
}
function hydrate(root) {
  $$("img[data-pid]", root).forEach((el) => {
    const p = PHOTO_INDEX.get(el.dataset.pid);
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
function updateCalcs(rec) {
  if (ROUTE.name !== "piece") return;
  const c = calc(rec);
  $$("[data-calc]").forEach((el) => {
    const v = c[el.dataset.calc];
    el.textContent = el.closest("summary") && v === "–" ? "" : v;
  });
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
  el.hidden = false;
  el.innerHTML = `<div class="sheet-back" data-act="sheet-close"></div><div class="sheet-card">${SHEET_VIEWS[SHEET.kind]()}</div>`;
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
          <button class="btn danger" data-act="ph-delete">${t("btn.delete")}</button></div>` : ""}`;
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
    $$(".card.piece[data-hay]").forEach((c) => { c.hidden = q && !c.dataset.hay.includes(q); });
    return;
  }
  if (!el.dataset.f || el.tagName === "SELECT") return;
  const rec = recOf(el);
  if (!rec) return;
  let v = el.value;
  if (el.dataset.num !== undefined) v = num(v);
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
    const name = prompt(LANG === "zh" ? "新泥料名称" : "New clay type");
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
      if (group && rec) { const cur = getPath(rec, group) || []; setPath(rec, group, [...new Set([...cur, v.trim()])]); touch(rec); }
      save(); render(true); return;
    }
    case "list-remove": listRemove(el.dataset.list, el.dataset.val); save(); render(true); return;
    case "new-piece": { const p = newRecord("pieces", { started: today(), unit: SETTINGS.unit }); save(); go("#/piece/" + p.id); return; }
    case "new-firing": { const f = newRecord("firings", { date: today(), type: "bisque" }); save(); go("#/firing/" + f.id); return; }
    case "new-design": { const d = newRecord("designs", { status: "concept" }); save(); go("#/design/" + d.id); return; }
    case "new-insp": { const x = newRecord("insps", { tags: [] }); save(); go("#/insp/" + x.id); return; }
    case "design-from-insp": { const d = newRecord("designs", { status: "concept", inspId: ROUTE.id }); save(); go("#/design/" + d.id); return; }
    case "piece-filter": PIECE_FILTER = el.dataset.val; render(true); return;
    case "ideas-tab": SETTINGS.ideasTab = el.dataset.val; saveSettings(); render(); return;
    case "toggle-filters": FILTERS_OPEN = !FILTERS_OPEN; render(true); return;
    case "clear-filters": SETTINGS.galleryFilters = {}; saveSettings(); render(true); return;
    case "clay-add": rec.clay = [...(rec.clay || []), { type: (rec.clay && rec.clay.length) ? "" : (listValues("clay")[0] || ""), g: null }]; changed(rec, true); return;
    case "clay-del": rec.clay.splice(Number(el.dataset.i), 1); changed(rec, true); return;
    case "delete": {
      const coll = el.dataset.coll;
      if (!confirm(t({ pieces: "confirm.deletePiece", firings: "confirm.deleteFiring", designs: "confirm.deleteDesign", insps: "confirm.deleteInsp" }[coll]))) return;
      const id = rec.id;
      if (coll === "firings") for (const p of piecesInFiring(id)) { for (const k of ["bisque", "glaze"]) if (p[k] && p[k].firingId === id) p[k].firingId = null; touch(p); }
      if (coll === "designs") for (const p of Object.values(DB.pieces)) if (p.designId === id) { p.designId = null; touch(p); }
      if (coll === "insps") {
        for (const p of Object.values(DB.pieces)) if ((p.inspIds || []).includes(id)) { p.inspIds = p.inspIds.filter((x) => x !== id); touch(p); }
        for (const d of Object.values(DB.designs)) if (d.inspId === id) { d.inspId = null; touch(d); }
      }
      removeRecord(coll, id); save();
      location.replace("#/" + TAB_OF[ROUTE.name]); return;
    }
    case "photo": {
      const pid = el.dataset.pid;
      if (!pid) return;
      const owner = el.dataset.owner || (rec && rec.id);
      openSheet({ kind: "photo", coll: "pieces", id: owner, pid }); return;
    }
    case "sheet-close": closeSheet(); render(true); return;
    case "ph-cover": { const { rec: r, ph } = sheetPhoto(); r.cover = ph.id; touch(r); save(); drawSheet(); return; }
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
  }
});

function onChip(el, rec) {
  const group = el.dataset.group, val = el.dataset.val, single = el.dataset.single !== undefined;
  if (group === "addStage") { ROUTE.addStage = val; $$(`[data-group="addStage"]`).forEach((b) => b.setAttribute("aria-pressed", b.dataset.val === val)); return; }
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
  if (single) setPath(rec, group, cur === val && group !== "sale.status" && group !== "status" && group !== "type" ? null : val);
  else { const arr = Array.isArray(cur) ? cur : []; setPath(rec, group, arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]); }
  if (group === "sale.status" && val === "sold" && !rec.sale.soldDate) rec.sale.soldDate = today();
  changed(rec, true);
}

async function onUpload(input) {
  const files = Array.from(input.files || []);
  input.value = "";
  if (!files.length) return;
  const target = input.dataset.upload;
  try {
    if (target === "newpiece" || target === "piece") {
      let p = target === "piece" ? DB.pieces[ROUTE.id] : newRecord("pieces", { started: today(), unit: SETTINGS.unit });
      const stage = target === "newpiece" ? "wet" : (ROUTE.addStage || stageOf(p));
      for (const f of files) {
        const ph = await Photos.fromFile(f, { stage, tags: [...(p.tags || [])] });
        p = DB.pieces[p.id] || p;   // a sync may have swapped the object while the photo was being saved
        p.photos = [...(p.photos || []), ph];
        if (!p.cover || stage === "final") p.cover = ph.id;
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
const APP_VERSION = "1";
setLang(SETTINGS.lang);
$("#back").addEventListener("click", () => { if (history.length > 1) history.back(); else go("#/" + (TAB_OF[ROUTE.name] || "pieces")); });
$("#lang").addEventListener("click", () => { SETTINGS.lang = LANG === "zh" ? "en" : "zh"; saveSettings(); setLang(SETTINGS.lang); render(true); if (SHEET) drawSheet(); });
$("#tabs").innerHTML = TABS.map((k) => `<a href="#/${k}" data-tab="${k}">${ICON[k]}<span></span></a>`).join("");
Sync.onChange(paintSync);
if (window.cloud) cloud.onAuth(() => paintSync());
ROUTE = parseRoute();
render();
Sync.run();
setInterval(() => { if (document.visibilityState === "visible") Sync.run(); }, 5 * 60000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") Sync.run(); });
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) navigator.serviceWorker.register("sw.js").catch(() => {});
