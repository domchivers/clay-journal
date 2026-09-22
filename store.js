/* The data: records in localStorage, photo files in IndexedDB, and sync with the cloud.
 *
 * DB = { pieces, firings, designs, insps }   each a map of id -> record with updatedAt
 *      lists: { tags, clay, glazes, channels }  each a map of value -> time added
 *      deleted: { "pieces:<id>": time, "list:tags:<value>": time }  tombstones, kept 90 days
 *
 * Two copies (this phone and the cloud) merge record by record: the more recently saved copy
 * of a record wins, and a tombstone newer than a record keeps it deleted. Device preferences
 * (language, currency, unit) live apart in SETTINGS and never sync. */
"use strict";

const LS_DB = "clay.db.v1", LS_SETTINGS = "clay.settings.v1";
const COLLECTIONS = ["pieces", "firings", "designs", "insps"];
const LISTS = ["tags", "clay", "glazes", "channels"];
const DEFAULT_LISTS = {
  tags: ["cup", "plate", "bowl", "vase", "marbled", "coffee_cup"],
  clay: ["white", "red", "black", "stoneware", "porcelain"],
  glazes: [],
  channels: ["instagram", "xhs", "inperson", "market"]
};
const TOMBSTONE_DAYS = 90;

const now = () => Date.now();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : now().toString(36) + Math.random().toString(36).slice(2, 10));
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

function emptyDB() {
  const lists = {};
  for (const l of LISTS) { lists[l] = {}; DEFAULT_LISTS[l].forEach((v, i) => { lists[l][v] = i + 1; }); }   // tiny times: any real edit beats a default
  return { v: 1, pieces: {}, firings: {}, designs: {}, insps: {}, lists, deleted: {} };
}
function normalise(d) {
  const e = emptyDB();
  if (!d || typeof d !== "object") return e;
  for (const c of COLLECTIONS) e[c] = (d[c] && typeof d[c] === "object") ? d[c] : {};
  if (d.lists) for (const l of LISTS) if (d.lists[l]) e.lists[l] = d.lists[l];
  e.deleted = d.deleted || {};
  return e;
}

let DB = (() => { try { return normalise(JSON.parse(localStorage.getItem(LS_DB))); } catch (e) { return emptyDB(); } })();
let SETTINGS = (() => {
  let s = {}; try { s = JSON.parse(localStorage.getItem(LS_SETTINGS)) || {}; } catch (e) {}
  const zh = /^zh/i.test(navigator.language || "");
  return Object.assign({ lang: zh ? "zh" : "en", currency: zh ? "¥" : "£", unit: "cm", galleryFilters: {}, ideasTab: "designs" }, s);
})();

function saveSettings() { try { localStorage.setItem(LS_SETTINGS, JSON.stringify(SETTINGS)); } catch (e) {} }
function persist() {
  try { localStorage.setItem(LS_DB, JSON.stringify(DB)); }
  catch (e) { toast(LANG === "zh" ? "手机存储已满，无法保存！" : "Phone storage is full, couldn't save!"); }
}
/** Call after any change: saves here straight away and queues a sync. */
function save() { persist(); Sync.schedule(); }
function touch(rec) { rec.updatedAt = now(); }

// ---------- records
function newRecord(coll, fields) {
  const r = Object.assign({ id: uid(), createdAt: now(), updatedAt: now() }, fields);
  DB[coll][r.id] = r;
  return r;
}
function removeRecord(coll, id) {
  const rec = DB[coll][id];
  delete DB[coll][id];
  DB.deleted[`${coll}:${id}`] = now();
  if (rec) Photos.forget(photosOf(rec));
}
/** Every photo object a record carries (pieces have a list, designs and inspiration one image). */
function photosOf(rec) {
  if (!rec) return [];
  if (Array.isArray(rec.photos)) return rec.photos;
  return rec.image ? [rec.image] : [];
}

// ---------- lists (tags, clay types, glazes, channels)
function listValues(name) {
  const m = DB.lists[name] || {};
  return Object.keys(m).sort((a, b) => m[a] - m[b]);
}
function listAdd(name, value) {
  value = String(value || "").trim();
  if (!value) return;
  if (!DB.lists[name][value]) { DB.lists[name][value] = now(); delete DB.deleted[`list:${name}:${value}`]; }
}
function listRemove(name, value) { delete DB.lists[name][value]; DB.deleted[`list:${name}:${value}`] = now(); }

// ---------- merging two copies
function merge(a, b) {
  a = normalise(a); b = normalise(b);
  const out = emptyDB();
  const cutoff = now() - TOMBSTONE_DAYS * 86400000;
  for (const k of new Set([...Object.keys(a.deleted), ...Object.keys(b.deleted)])) {
    const ts = Math.max(a.deleted[k] || 0, b.deleted[k] || 0);
    if (ts > cutoff) out.deleted[k] = ts;
  }
  for (const c of COLLECTIONS) {
    for (const id of new Set([...Object.keys(a[c]), ...Object.keys(b[c])])) {
      const x = a[c][id], y = b[c][id];
      const win = !x ? y : !y ? x : ((y.updatedAt || 0) > (x.updatedAt || 0) ? y : x);
      const gone = out.deleted[`${c}:${id}`];
      if (gone && gone >= (win.updatedAt || 0)) continue;
      out[c][id] = win;
    }
  }
  for (const l of LISTS) {
    out.lists[l] = {};
    for (const v of new Set([...Object.keys(a.lists[l]), ...Object.keys(b.lists[l])])) {
      const ts = Math.max(a.lists[l][v] || 0, b.lists[l][v] || 0);
      const gone = out.deleted[`list:${l}:${v}`];
      if (gone && gone >= ts) continue;
      out.lists[l][v] = ts;
    }
  }
  return out;
}
function stable(v) {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
  return JSON.stringify(v === undefined ? null : v);
}

// ---------- photos: compressed on the phone, kept in IndexedDB, uploaded when signed in
const Photos = (() => {
  let dbp = null;
  function idb() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open("clay", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("blobs");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(mode, fn) {
    const db = await idb();
    return new Promise((res, rej) => {
      const t = db.transaction("blobs", mode), st = t.objectStore("blobs");
      const out = fn(st);
      t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
      t.onerror = () => rej(t.error);
    });
  }
  const get = (k) => tx("readonly", (s) => s.get(k)).catch(() => null);
  const put = (k, v) => tx("readwrite", (s) => { s.put(v, k); });
  const del = (k) => tx("readwrite", (s) => { s.delete(k); }).catch(() => {});

  function loadImage(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Couldn't read that image")); };
      img.src = url;
    });
  }
  function scaled(img, max, q) {
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return new Promise((res) => c.toBlob(res, "image/jpeg", q));
  }
  const urls = new Map();   // object URLs for blobs on this phone, made once per session

  return {
    /** A file from the camera or photo library -> a photo object, its files saved on the phone. */
    async fromFile(file, fields) {
      const img = await loadImage(file);
      const [full, thumb] = await Promise.all([scaled(img, 1800, 0.84), scaled(img, 480, 0.78)]);
      const p = Object.assign({ id: uid(), at: today(), tags: [], w: img.naturalWidth, h: img.naturalHeight }, fields);
      await put(p.id, full);
      await put(p.id + ".t", thumb);
      return p;
    },
    /** Where an <img> can load this photo from: the cloud if uploaded, else the copy on this phone. */
    async src(p, thumb) {
      if (!p) return "";
      const cloudUrl = thumb ? (p.thumb || p.url) : p.url;
      const key = thumb ? p.id + ".t" : p.id;
      if (urls.has(key)) return urls.get(key);
      const b = await get(key) || (thumb ? await get(p.id) : null);
      if (b) { const u = URL.createObjectURL(b); urls.set(key, u); return u; }
      return cloudUrl || "";
    },
    forget(list) { for (const p of list) { del(p.id); del(p.id + ".t"); } },
    get, del,
    /** Every photo not yet in the cloud, with the record that holds it. */
    pending() {
      const out = [];
      for (const c of COLLECTIONS) for (const rec of Object.values(DB[c])) for (const p of photosOf(rec)) if (!p.url) out.push({ c, id: rec.id, p });
      return out;
    }
  };
})();

// ---------- sync
const Sync = (() => {
  let timer = null, running = false, again = false, pulled = false;
  const state = { status: "idle", msg: "", last: Number(localStorage.getItem("clay.lastSync")) || 0 };
  const listeners = [];
  function set(status, msg = "") { state.status = status; state.msg = msg; listeners.forEach((f) => f(state)); }

  async function uploadPending() {
    let changed = false;
    for (const { c, id, p } of Photos.pending()) {
      const full = await Photos.get(p.id);
      if (!full) continue;   // taken on another phone that hasn't uploaded it yet
      const thumb = await Photos.get(p.id + ".t");
      const url = await cloud.upload(full, p.id);
      const turl = thumb ? await cloud.upload(thumb, p.id + "-t") : url;
      const rec = DB[c][id];   // look again: a merge may have replaced the record meanwhile
      const live = rec && photosOf(rec).find((x) => x.id === p.id);
      if (!live) continue;
      live.url = url; live.thumb = turl; touch(rec); changed = true;
      persist();
    }
    return changed;
  }

  async function run() {
    if (!window.cloud || !cloud.user) return;
    if (!navigator.onLine) { set("offline"); return; }
    if (running) { again = true; return; }
    running = true; set("syncing");
    let remoteChanged = false;
    try {
      const remote = await cloud.pull();
      pulled = true;
      if (remote) {
        const before = stable(DB);
        DB = merge(DB, remote);
        remoteChanged = stable(DB) !== before;
        if (remoteChanged) persist();
      }
      await uploadPending();
      if (!remote || stable(DB) !== stable(normalise(remote))) await cloud.push(DB);
      state.last = now(); localStorage.setItem("clay.lastSync", String(state.last));
      set("ok");
    } catch (e) {
      set("error", cloud.explain(e));
    } finally {
      running = false;
      if (remoteChanged && typeof onRemoteChange === "function") onRemoteChange();
      if (again) { again = false; run(); }
    }
  }
  return {
    state,
    onChange(f) { listeners.push(f); },
    run,
    /** After an edit: wait for typing to settle, then pull, merge and push. Never pushes before a first pull. */
    schedule() {
      if (!window.cloud || !cloud.user) return;
      clearTimeout(timer);
      timer = setTimeout(run, pulled ? 2500 : 0);
    },
    reset() { pulled = false; }
  };
})();

window.addEventListener("online", () => Sync.run());
