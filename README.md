# Clay Journal · 陶记

A phone app for logging every pottery piece from wet clay through bisque and glaze
to the finished (and maybe sold) piece. English and Chinese, switch with the 中/EN
button at the top.

- **Pieces**: one record per piece. Technique, category tags, clay bodies with grams
  (total adds itself up), wet / bisque / final dimensions with **shrinkage worked out
  automatically**, weights before and after trimming, drying, glazes and how they
  went on, outcome and defects, photos tagged by stage, sales.
- **Handles** (optional, inside each stage): length as cut, then the attached handle's
  length, width and height at the wet stage, after bisque and on the finished piece,
  with its own shrinkage worked out.
- **Gallery**: every photo from every piece, filterable by stage, tag, technique,
  sale status, outcome and date.
- **Firings**: one record per kiln run, many pieces per firing. Pick one or create
  one straight from a piece's bisque or glaze stage; linking is always optional.
- **Ideas**: Designs (a Procreate export, or just a written idea) and Inspiration
  (screenshots, photos, where they came from, notes). Pieces link to the design
  they came from and any inspiration used.

Every number is optional: log the wet stage today and fill in bisque numbers next week.

## Running it

No build step. Double-click `start.bat` and open the address it prints on the phone
(same Wi-Fi). For **Add to Home Screen** and offline use it needs HTTPS, so the real
home is GitHub Pages.

Installed phones update themselves: the service worker is network-first, so every
open loads the latest files (falling back to the cached copy offline or after 4 s of
slow Wi-Fi), and when the app comes back from the background it checks the server's
file fingerprints and reloads if anything was published. Bumping the `?v=` numbers
and `CACHE` in `sw.js` is still good hygiene but no longer required.

Zoom is locked (viewport, `touch-action`, and a pinch blocker for iOS, which ignores
`user-scalable=no`), and the page can't pan sideways or rubber-band.

## Accounts, sync and photos

Uses the same Supabase project as Bùbù and Cheat Days, so the same email and
password work. Local-first: everything saves on the phone immediately and works
offline; signing in adds the cloud copy.

- Records sync through one row per person in the `pottery` table. Two phones merge
  piece by piece: the more recently saved copy of a record wins, and deletions are
  remembered for 90 days so they stay deleted.
- Photos are shrunk on the phone (1800 px, plus a 480 px thumbnail), kept in
  IndexedDB, and uploaded to the existing public `photos` bucket under
  `<user id>/pottery/` with unguessable names once signed in. A small orange dot on a
  photo means it hasn't uploaded yet.

One-off setup in the Supabase **SQL Editor** (the `photos` bucket and its policies
already exist from Cheat Days):

```sql
create table if not exists public.pottery (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.pottery enable row level security;
create policy "own pottery" on public.pottery
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**Settings → Export** downloads everything as JSON (photo links included, not the
photo files); **Import** merges a file back in.
