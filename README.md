# Clay Journal · 陶记

A phone app for logging every pottery piece from wet clay through bisque and glaze
to the finished (and maybe sold) piece. English and Chinese, switch with the 中/EN
button at the top.

The layout follows `mockup.html` (open it at /mockup.html): one stage at a time,
plain rows instead of boxes, and the previous panelled design kept on the
`backup-v7-panels` branch and the `v7-panels` tag.

- **Pieces**: one record per piece. Technique, category tags, clay bodies with grams
  (total adds itself up), wet / bisque / final dimensions with **shrinkage worked out
  automatically**, weights before and after trimming, drying, glazes and how they
  went on, outcome and defects, photos tagged by stage, sales.
- **Handles** (optional, inside each stage): length as cut, then the attached handle's
  length, width and height at the wet stage, after bisque and on the finished piece,
  with its own shrinkage worked out.
- **The wall**: Pieces opens as a grid of cover photos; tap one to open and edit that
  piece. Two buttons above it switch between the wall and a list, and turn the names
  underneath on or off.
- **Costs**: log an order — the shop, the bags of clay and tubs of glaze on it, and the
  delivery fee, which is spread over them in proportion to what each cost. Every piece
  is then costed from what it actually used, at the average rate you've paid. A communal
  firing's fee and travel are split equally between the pieces in it, and each piece's
  Cost tab shows the breakdown, any extra cost, the asking or sale price and the profit.
- **Firings**: home kiln or communal kiln. A communal trip records the studio, the fee,
  travel, the date sent and the date collected, and which pieces went.
- **Shapes**: a piece is a mug, bowl, plate, vase, box, something irregular, or a shape
  of your own with the measurements you name; the app then asks for those measurements
  at every stage. Greenware records size as thrown and again after trimming.
  Pick one from a piece's bisque or glaze stage or create it there; linking is
  always optional.
- **Ideas**: Designs (a Procreate export, or just a written idea) and Inspiration
  (screenshots, photos, where they came from, notes). Pieces link to the design
  they came from and any inspiration used.

Every number is optional: log the wet stage today and fill in bisque numbers next week.

Hold a tag, clay, glaze, studio or one of your own shapes to take it off the list,
and hold a photo tile to delete that piece, design or inspiration.
In any list, swipe a row left to uncover **Delete** (it still asks first);
tap the row again to put it back.

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

## Backups

Four layers, so nothing can quietly disappear:

1. **Sync never uploads first.** After signing in the app pulls and merges before it
   pushes, so a fresh install can't overwrite what's in the cloud.
2. **A copy on the phone**, in IndexedDB away from the main store: one per day the app
   is used, the last seven kept. If the main copy is ever missing at start-up, the
   newest is put back automatically.
3. **Daily copies in the cloud** (last 30), made by a database trigger. Settings lists
   every phone and cloud copy with a **Restore** button; restoring adds back what's
   missing and never removes anything, so it undoes an accidental delete.
4. **Export** writes the lot to a JSON file you keep yourself.

One-off setup for layer 3, in the SQL Editor:

```sql
create table if not exists public.pottery_backups (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists pottery_backups_user on public.pottery_backups (user_id, created_at desc);
alter table public.pottery_backups enable row level security;
drop policy if exists "pottery backups read own" on public.pottery_backups;
create policy "pottery backups read own" on public.pottery_backups for select to authenticated using (user_id = auth.uid());

create or replace function public.pottery_snapshot() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- keep the copy being replaced, at most one every 20 hours, never an empty one
  if old.data is not null
     and coalesce((select count(*) from jsonb_object_keys(coalesce(old.data->'pieces', '{}'::jsonb))), 0) > 0
     and not exists (select 1 from pottery_backups where user_id = old.user_id and created_at > now() - interval '20 hours') then
    insert into pottery_backups (user_id, data) values (old.user_id, old.data);
    delete from pottery_backups where user_id = old.user_id and id not in
      (select id from pottery_backups where user_id = old.user_id order by created_at desc limit 30);
  end if;
  return new;
end $$;
drop trigger if exists pottery_snapshot on public.pottery;
create trigger pottery_snapshot before update on public.pottery for each row execute function public.pottery_snapshot();
```

### Keeping the Supabase project alive

A free Supabase project pauses after about a week with no activity; the data stays,
but signing in fails until it's resumed from the dashboard. Normal use of any of the
three apps counts as activity. Photos share the 1 GB free storage allowance — at
roughly 250 KB a photo that's thousands of them, and Settings shows how many are
still waiting to upload.

**Settings → Export** downloads everything as JSON (photo links included, not the
photo files); **Import** merges a file back in.
