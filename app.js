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
  if (any(p.bisque, ["l", "w", "h", "weight", "firingId"]) || hasHandle(p.bisque)) i = 1;
  if (any(p.glaze, ["glazes", "method", "firingId"])) i = 2;
  if (any(p.final, ["l", "w", "h", "weight", "outcome"]) || hasHandle(p.final)) i = 3;
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
    shrinkHB: shrinkText(shrink(handleOf(p.wet), handleOf(p.bisque))),
    shrinkHF: shrinkText(shrink(handleOf(p.wet), handleOf(p.final))),
    stage: t("stage." + stageOf(p))
  };
}
const handleOf = (o) => (o && o.handle) || null;
const hasHandle = (o) => { const h = handleOf(o); return !!h && ["cut", "l", "w", "h"].some((k) => has(h[k])); };
/** The optional handle block inside a stage: length as cut (wet only), then size once attached. */
function handleBlock(stage, o, unit, withCut, c) {
  const h = handleOf(o) || {};
  const open = hasHandle(o) || OPEN.has(stage + "-handle");
  return `<details class="sub" data-sec="${stage}-handle"${open ? " open" : ""}><summary>${t("f.handle")}</summary><div class="sub-body">
    ${withCut ? field(`${t("f.handleCut")} (${esc(unit)})`, numIn(`${stage}.handle.cut`, h.cut)) : ""}
    <span class="lbl">${t("f.handleDims")}</span>
    ${dims(`${stage}.handle`, h, unit)}
    ${stage === "wet" ? "" : `<div class="calc"><span>${t(stage === "bisque" ? "f.shrinkHandleB" : "f.shrinkHandleF")}</span><b data-calc="${stage === "bisque" ? "shrinkHB" : "shrinkHF"}">${stage === "bisque" ? c.shrinkHB : c.shrinkHF}</b></div>`}
  </div></details>`;
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
  pieces: '<svg viewBox="0 0 24 24"><path d="M9 3h6M9.5 3l-.4 2.6a4 4 0 0 1-.9 2L7 9.4A6.5 6.5 0 0 0 5.6 13v4.5A3.5 3.5 0 0 0 9.1 21h5.8a3.5 3.5 0 0 0 3.5-3.5V13a6.5 6.5 0 0 0-1.4-3.6l-1.2-1.8a4 4 0 0 1-.9-2L14.5 3"/></svg>',
  gallery: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M3.5 17.5l4.7-4.2a2 2 0 0 1 2.7 0l3.3 3M14 15.2l1.9-1.6a2 2 0 0 1 2.6 0l2 1.7"/></svg>',
  firings: '<svg viewBox="0 0 24 24"><path d="M4.5 9.5a7.5 7.5 0 0 1 15 0v9.2a1.3 1.3 0 0 1-1.3 1.3H5.8a1.3 1.3 0 0 1-1.3-1.3z"/><path d="M4.7 8h14.6M9 20v-4.2a3 3 0 0 1 6 0V20"/><path d="M12 4.6c.2 1.3 1.2 1.7 1.2 2.8a1.2 1.2 0 0 1-2.4 0c0-.6.3-1 .6-1.3"/></svg>',
  more: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M12 3.4l1.3 2.2 2.5-.4.5 2.5 2.2 1.3-1.4 2.1 1.4 2.1-2.2 1.3-.5 2.5-2.5-.4L12 20.6l-1.3-2.2-2.5.4-.5-2.5L5.5 15l1.4-2.1L5.5 10.8 7.7 9.5l.5-2.5 2.5.4z"/></svg>',
  ideas: '<svg viewBox="0 0 24 24"><path d="M9.5 18h5M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2h5c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M3.5 8.5h3.2l1.6-2.6h7.4l1.6 2.6h3.2v10.6H3.5z"/><circle cx="12" cy="13.6" r="3.4"/></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M3.5 17.5l4.7-4.2a2 2 0 0 1 2.7 0l3.3 3M14 15.2l1.9-1.6a2 2 0 0 1 2.6 0l2 1.7"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5.5v13M5.5 12h13"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.6"/><path d="M19.5 19.5l-3.8-3.8"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="M9.5 5.5L16 12l-6.5 6.5"/></svg>',
  filter: '<svg viewBox="0 0 24 24"><path d="M4.5 6.5h15M7 12h10M10 17.5h4"/></svg>'
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

const TABS = ["pieces", "gallery", "firings", "ideas"];
const TAB_OF = { piece: "pieces", firing: "firings", design: "ideas", insp: "ideas", settings: "more", more: "pieces" };

// ---------- views
const VIEWS = {};

VIEWS.pieces = () => {
  const all = sortedPieces();
  const filters = ["all", ...STAGES, "for", "sold"];
  const shown = all.filter((p) => PIECE_FILTER === "all" ? true : STAGES.includes(PIECE_FILTER) ? stageOf(p) === PIECE_FILTER : (p.sale && p.sale.status) === PIECE_FILTER);
  const fl = (v) => v === "all" ? (LANG === "zh" ? "全部" : "All") : STAGES.includes(v) ? t("stage." + v) : t("sale." + v);
  return `
    ${all.length ? `<div class="toolbar"><label class="search">${ICON.search}<input type="search" data-search placeholder="${t("search")}"></label>
      <div class="wordtabs">${filters.map((v) => `<button data-act="piece-filter" data-val="${v}" aria-pressed="${PIECE_FILTER === v}">${esc(fl(v))}</button>`).join("")}</div></div>` : ""}
    <div class="cards">${shown.map(pieceCard).join("") || empty(all.length ? t("empty.gallery") : t("empty.pieces"))}</div>
    <div class="fab">${`<label class="fab-cam" aria-label="${t("btn.takePhoto")}"><input type="file" accept="image/*" capture="environment" hidden data-upload="newpiece">${ICON.camera}</label>`}
      <button class="btn primary" data-act="new-piece">${ICON.plus} ${t("btn.newPiece")}</button></div>`;
};
function pieceCard(p) {
  const st = stageOf(p), s = p.sale || {};
  const line = [t("stage." + st), s.status === "sold" ? `${t("sale.sold")}${has(s.price) || has(s.ask) ? " " + money(has(s.price) ? s.price : s.ask) : ""}`
    : s.status === "for" ? `${t("sale.for")}${has(s.ask) ? " " + money(s.ask) : ""}`
    : p.final && p.final.outcome && p.final.outcome !== "success" ? t("outcome." + p.final.outcome) : dateText(p.started)].filter(Boolean).join(" · ");
  const hay = [p.title, p.notes, ...(p.tags || []).map((x) => label("tag", x)), ...(p.technique || []).map((x) => label("tech", x)), ...((p.glaze && p.glaze.glazes) || [])].join(" ").toLowerCase();
  return `<a class="card piece" href="#/piece/${esc(p.id)}" data-hay="${esc(hay)}">
    ${img(coverOf(p), "thumb")}
    <div class="card-body">
      <div class="card-title">${esc(pieceName(p))}</div>
      <div class="meta"><i class="dot st-${st}"></i>${esc(line)}</div>
    </div></a>`;
}

/* A piece is one stage at a time: the tabs across the top swap what's below them, so only
 * the handful of numbers that matter right now is on screen. */
const PIECE_TABS = ["wet", "bisque", "glaze", "final", "design", "sales"];
let PIECE_TAB = null, PIECE_TAB_FOR = null;
const tabLabel = (k) => k === "glaze" ? t("stage.glazed") : k === "design" ? t("tab.design") : k === "sales" ? t("sec.sales") : t("stage." + k);
/** Has anything been filled in for this tab yet? Marks the tab with a small dot. */
function tabFilled(p, k) {
  const any = (o, ks) => o && ks.some((x) => { const v = o[x]; return Array.isArray(v) ? v.length : (has(v) || (typeof v === "string" && v)); });
  if (k === "wet") return any(p.wet, ["l", "w", "h", "weight", "trimmed", "dryDays", "dryNotes"]) || hasHandle(p.wet) || (p.clay || []).length > 0 || (p.technique || []).length > 0;
  if (k === "bisque") return any(p.bisque, ["l", "w", "h", "weight", "firingId"]) || hasHandle(p.bisque);
  if (k === "glaze") return any(p.glaze, ["glazes", "method", "firingId"]);
  if (k === "final") return any(p.final, ["l", "w", "h", "weight", "outcome"]) || hasHandle(p.final);
  if (k === "design") return !!p.designId || (p.inspIds || []).length > 0;
  return !!(p.sale && p.sale.status && p.sale.status !== "not");
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
    <div class="hero" data-act="${photos.length ? "photo" : ""}" data-pid="${esc((coverOf(p) || {}).id || "")}">${photos.length ? img(coverOf(p), "hero-img", false) : `<label class="hero-add"><input type="file" accept="image/*" capture="environment" hidden data-upload="piece">${ICON.camera}<span>${t("btn.takePhoto")}</span></label>`}</div>
    <input class="title-in" type="text" data-f="title" value="${esc(p.title || "")}" placeholder="${esc(t("untitled"))}">
    <div class="ptabs">${PIECE_TABS.map((k) => `<button data-act="piece-tab" data-val="${k}" aria-pressed="${k === tab}">${esc(tabLabel(k))}${tabFilled(p, k) ? `<i class="dot st-${k === "glaze" ? "glazed" : k}"></i>` : ""}</button>`).join("")}</div>
    <div class="tabbody">${TAB_BODY[tab](p, c, u)}</div>

    <div class="photos">
      <div class="ph-grid">${photos.map((ph) => `<button class="ph" data-act="photo" data-pid="${esc(ph.id)}">${img(ph)}<span class="pill st-${ph.stage}">${t("stage." + ph.stage)}</span>${ph.id === p.cover ? '<i class="star">★</i>' : ""}${ph.url ? "" : '<i class="dot" title="not uploaded"></i>'}</button>`).join("")}
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
    const w = p.wet || {};
    const clayRows = (p.clay || []).map((row, i) => `<div class="clay-row">
      <select data-f="clay.${i}.type" data-list="clay"><option value="">${t("f.clayType")}</option>${[...new Set([...listValues("clay"), row.type].filter(Boolean))].map((v) => `<option value="${esc(v)}"${v === row.type ? " selected" : ""}>${esc(label("clay", v))}</option>`).join("")}<option value="__new__">+ …</option></select>
      <input type="number" inputmode="numeric" step="any" data-f="clay.${i}.g" data-num value="${has(row.g) ? esc(row.g) : ""}" placeholder="g">
      <button class="icon-btn" data-act="clay-del" data-i="${i}" aria-label="${t("btn.delete")}">${ICON.x}</button></div>`).join("");
    return `
      <div class="row between"><span class="lbl">${t("f.dims")}</span><select data-f="unit" class="unit">${UNITS.map((x) => `<option${x === u ? " selected" : ""}>${x}</option>`).join("")}</select></div>
      ${dims("wet", w, u)}
      <div class="grid2">${field(t("f.weight"), numIn("wet.weight", w.weight))}${field(t("f.weightTrimmed"), numIn("wet.trimmed", w.trimmed))}</div>
      ${has(w.weight) && has(w.trimmed) ? `<div class="calc"><span>${t("f.trimmedOff")}</span><b data-calc="trimmed">${c.trimmed}</b></div>` : ""}
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
      ${dims("bisque", b, u)}
      ${c.shrinkB === "–" ? "" : `<div class="calc"><span>${t("f.shrinkBisque")}</span><b data-calc="shrinkB">${c.shrinkB}</b></div>`}
      ${handleBlock("bisque", b, u, false, c)}
      ${field(t("f.weightBisque"), numIn("bisque.weight", b.weight))}
      ${field(t("f.firing"), firingSelect("bisque.firingId", b.firingId, "bisque"))}`;
  },
  glaze(p) {
    const g = p.glaze || {};
    return `
      ${field(t("f.glazes"), chips("glaze.glazes", [...new Set([...listValues("glazes"), ...(g.glazes || [])])], g.glazes, (v) => v, { add: "glazes" }))}
      ${field(t("f.method"), chips("glaze.method", METHODS, g.method, (v) => t("method." + v)))}
      ${field(t("f.firing"), firingSelect("glaze.firingId", g.firingId, "glaze"))}`;
  },
  final(p, c, u) {
    const f = p.final || {};
    return `
      <span class="lbl">${t("f.dimsFinal")} (${esc(u)})</span>
      ${dims("final", f, u)}
      ${c.shrinkF === "–" ? "" : `<div class="calc"><span>${t("f.shrinkFinal")}</span><b data-calc="shrinkF">${c.shrinkF}</b></div>`}
      ${handleBlock("final", f, u, false, c)}
      ${field(t("f.weightFinal"), numIn("final.weight", f.weight))}
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
  sales(p) {
    const s = p.sale || {};
    return `
      ${field(t("f.saleStatus"), chips("sale.status", SALES, s.status || "not", (v) => t("sale." + v), { single: true }))}
      ${s.status && s.status !== "not" ? `
        <div class="grid2">${field(`${t("f.askPrice")} (${esc(SETTINGS.currency)})`, numIn("sale.ask", s.ask))}${s.status === "sold" ? field(`${t("f.salePrice")} (${esc(SETTINGS.currency)})`, numIn("sale.price", s.price)) : ""}</div>
        ${field(t("f.channel"), textIn("sale.channel", s.channel ? label("chan", s.channel) : "", "", "dl-channels"))}
        ${s.status === "sold" ? `<div class="grid2">${field(t("f.soldDate"), dateIn("sale.soldDate", s.soldDate))}${field(t("f.buyer"), textIn("sale.buyer", s.buyer))}</div>` : ""}` : ""}`;
  }
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
  const stageWords = `<div class="wordtabs">${["", ...STAGES].map((v) => `<button data-act="chip" data-group="gf.stage" data-val="${v}" data-single aria-pressed="${(F.stage || "") === v}">${v ? t("stage." + v) : (LANG === "zh" ? "全部" : "All")}</button>`).join("")}</div>`;
  return `
    <div class="toolbar">${stageWords}
      <div class="row between"><span class="meta">${t("photos.count", { n: shown.length })}</span>
        <span class="row">${active ? `<button class="btn small ghost" data-act="clear-filters">${t("btn.clear")}</button>` : ""}<button class="btn small${active ? " primary" : ""}" data-act="toggle-filters">${ICON.filter} ${LANG === "zh" ? "筛选" : "Filters"}${active ? " · " + active : ""}</button></span></div></div>
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
  const seg = `<div class="toolbar"><div class="wordtabs">${["designs", "insp"].map((x) => `<button data-act="ideas-tab" data-val="${x}" aria-pressed="${tab === x}">${t("ideas." + x)}</button>`).join("")}</div></div>`;
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

VIEWS.more = () => {
  const sold = Object.values(DB.pieces).filter((p) => p.sale && p.sale.status === "sold");
  const forSale = Object.values(DB.pieces).filter((p) => p.sale && p.sale.status === "for");
  const total = (list, keys) => list.reduce((a, p) => { const k = keys.find((x) => has(p.sale[x])); return a + (k ? Number(p.sale[k]) : 0); }, 0);
  return `<div class="rows">
      <div class="srow">${t("sale.sold")}<span class="v">${sold.length ? `${t("pieces.count", { n: sold.length })} · ${esc(money(total(sold, ["price", "ask"])))}` : "–"}</span></div>
      <div class="srow">${t("sale.for")}<span class="v">${forSale.length ? `${t("pieces.count", { n: forSale.length })} · ${esc(money(total(forSale, ["ask"])))}` : "–"}</span></div>
    </div>` + VIEWS.settings();
};

VIEWS.settings = () => {
  const u = window.cloud && cloud.user;
  const pend = Photos.pending().length;
  const listEd = (name, lab, labFn) => `<div class="fgroup"><span class="lbl">${lab}</span><div class="chips">${listValues(name).map((v) => `<span class="chip listed">${esc(labFn(v))}<button data-act="list-remove" data-list="${name}" data-val="${esc(v)}" aria-label="${t("btn.delete")}">×</button></span>`).join("")}<button class="chip add" data-act="list-add" data-list="${name}">+</button></div></div>`;
  return `<div class="pad settings">
    <h3>${t("set.language")}</h3>
    <div class="panel"><div class="seg">${[["en", "English"], ["zh", "中文"]].map(([k, n]) => `<button data-act="lang" data-val="${k}" aria-pressed="${LANG === k}">${n}</button>`).join("")}</div>

</div>
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
    case "piece-tab": PIECE_TAB = el.dataset.val; render(); window.scrollTo(0, 0); return;
    case "ideas-tab": SETTINGS.ideasTab = el.dataset.val; saveSettings(); render(); return;
    case "ideas-open": SETTINGS.ideasTab = el.dataset.val; saveSettings(); return;   // the link carries on to #/ideas
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
    case "force-update": return forceUpdate(el);
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
const APP_VERSION = "11";
setLang(SETTINGS.lang);
$("#back").addEventListener("click", () => { if (history.length > 1) history.back(); else go("#/" + (TAB_OF[ROUTE.name] || "pieces")); });
$("#gear").addEventListener("click", () => { if (ROUTE.name === "more") history.back(); else go("#/more"); });
$("#lang").addEventListener("click", () => { SETTINGS.lang = LANG === "zh" ? "en" : "zh"; saveSettings(); setLang(SETTINGS.lang); render(true); if (SHEET) drawSheet(); });
$("#tabs").innerHTML = TABS.map((k) => `<a href="#/${k}" data-tab="${k}">${ICON[k]}</a>`).join("");
Sync.onChange(paintSync);
if (window.cloud) cloud.onAuth(() => paintSync());
ROUTE = parseRoute();
render();
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
