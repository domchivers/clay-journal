/* Accounts, sync and photo storage through Supabase: the same project as Bùbù and Cheat Days,
 * so one email + password works everywhere. Plain fetch() against the REST API, no SDK.
 *
 * LOCAL-FIRST: localStorage (records) and IndexedDB (photos) are the source of truth and
 * everything works offline. Signing in adds a cloud copy in the `pottery` table (one row per
 * user, JSON in `data`) and uploads photos to the public `photos` bucket under the user's
 * own folder with unguessable names.
 *
 * The anon key in supabase-config.js is PUBLIC by design; row-level security protects the
 * data. The service_role key must never appear anywhere in this app. */
"use strict";

(function () {
  const cfg = window.SUPABASE_CONFIG;
  if (!cfg || !cfg.url || !cfg.anonKey) { window.cloud = null; return; }
  const URL_ = cfg.url, KEY = cfg.anonKey;
  const TABLE = "pottery";
  const LS_SESSION = "clay.session.v1";

  let session = (() => { try { return JSON.parse(localStorage.getItem(LS_SESSION)) || null; } catch (e) { return null; } })();
  const listeners = [];
  const signedIn = () => !!(session && session.access_token);
  const userOf = () => signedIn() ? { id: session.user.id, email: session.user.email } : null;
  function setSession(s) {
    session = s;
    try { if (s) localStorage.setItem(LS_SESSION, JSON.stringify(s)); else localStorage.removeItem(LS_SESSION); } catch (e) {}
    listeners.forEach((cb) => cb(userOf()));
  }

  function sb(path, opts = {}, useAuth = true) {
    const headers = Object.assign({ apikey: KEY, "Content-Type": "application/json" }, opts.headers || {});
    if (useAuth && signedIn()) headers.Authorization = `Bearer ${session.access_token}`;
    return fetch(URL_ + path, Object.assign({}, opts, { headers }));
  }
  // Access tokens expire after about an hour: refresh once and replay. Only a definite
  // rejection of the refresh token ends the session, never a network blip.
  async function sbAuthed(path, opts = {}) {
    const r = await sb(path, opts);
    if (r.status !== 401 || !session || !session.refresh_token) return r;
    let rr;
    try { rr = await sb("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: session.refresh_token }) }, false); }
    catch (e) { return r; }
    if (!rr.ok) { if (rr.status === 400 || rr.status === 401) setSession(null); return r; }
    setSession(await rr.json());
    return sb(path, opts);
  }
  async function fail(r, fallback) {
    const j = await r.json().catch(() => ({}));
    const e = new Error(j.error_description || j.msg || j.message || j.error || fallback);
    e.status = r.status;
    return e;
  }

  window.cloud = {
    get user() { return userOf(); },
    onAuth(cb) { listeners.push(cb); },
    async signIn(email, password) {
      const r = await sb("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) }, false);
      if (!r.ok) throw await fail(r, "Sign-in failed");
      setSession(await r.json());
    },
    /** Resolves true when signed in straight away, false when Supabase wants the email confirmed first. */
    async signUp(email, password) {
      const r = await sb("/auth/v1/signup", { method: "POST", body: JSON.stringify({ email, password }) }, false);
      if (!r.ok) throw await fail(r, "Sign-up failed");
      const j = await r.json();
      if (j.access_token) { setSession(j); return true; }
      return false;
    },
    async signOut() { setSession(null); },   // local data is deliberately left alone
    async resetPassword(email) {
      const r = await sb("/auth/v1/recover", { method: "POST", body: JSON.stringify({ email }) }, false);
      if (!r.ok) throw await fail(r, "Couldn't send the reset email");
    },
    /** The cloud copy, or null if this account hasn't saved one yet. */
    async pull() {
      const r = await sbAuthed(`/rest/v1/${TABLE}?user_id=eq.${session.user.id}&select=data,updated_at`);
      if (!r.ok) throw await fail(r, `Couldn't read from the cloud (${r.status})`);
      const rows = await r.json();
      return rows.length ? rows[0].data : null;
    },
    async push(data) {
      const r = await sbAuthed(`/rest/v1/${TABLE}`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify([{ user_id: session.user.id, data, updated_at: new Date().toISOString() }])
      });
      if (!r.ok) throw await fail(r, `Couldn't save to the cloud (${r.status})`);
    },
    /** Upload one JPEG blob; resolves to its public URL. */
    async upload(blob, name) {
      const path = `${session.user.id}/pottery/${name}.jpg`;
      const go = () => fetch(`${URL_}/storage/v1/object/photos/${path}`, {
        method: "POST",
        headers: { apikey: KEY, Authorization: `Bearer ${session.access_token}`, "Content-Type": "image/jpeg", "x-upsert": "true", "cache-control": "31536000" },
        body: blob
      });
      let r = await go();
      if (r.status === 401 || r.status === 403) {   // storage answers an expired token with 400/403 too; refresh and retry once
        await sbAuthed(`/rest/v1/${TABLE}?select=user_id&limit=0`);
        if (signedIn()) r = await go();
      }
      if (!r.ok) throw await fail(r, `Upload failed (${r.status})`);
      return `${URL_}/storage/v1/object/public/photos/${path}`;
    },
    explain(err) {
      const m = String((err && err.message) || err || "").toLowerCase();
      const zh = typeof LANG !== "undefined" && LANG === "zh";
      if (m.includes("invalid login") || m.includes("invalid credentials")) return zh ? "邮箱或密码不对。" : "Email or password isn't right.";
      if (m.includes("already registered")) return zh ? "这个邮箱已经注册过了，请直接登录。" : "There's already an account with that email. Try signing in.";
      if (m.includes("password") && m.includes("least")) return zh ? "密码至少 6 位。" : "Password needs at least 6 characters.";
      if (m.includes("valid email") || m.includes("invalid email")) return zh ? "邮箱格式不对。" : "That email address doesn't look right.";
      if (m.includes("failed to fetch") || m.includes("network")) return zh ? "没有网络，稍后再试。" : "No connection. Try again when you're online.";
      if (m.includes("rate limit") || m.includes("too many")) return zh ? "尝试次数太多，请等一分钟。" : "Too many tries. Wait a minute and try again.";
      if (m.includes("schema cache") || (m.includes("relation") && m.includes("does not exist"))) return t("sync.table");
      return (err && err.message) || (zh ? "出错了。" : "Something went wrong.");
    }
  };
})();
