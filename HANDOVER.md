# Handover

Everything needed to pick this up on another machine. The app is live at
**https://domchivers.github.io/clay-journal/** and deploys by pushing `master`.

```bash
git clone https://github.com/domchivers/clay-journal.git
cd clay-journal
python3 -m http.server 8011      # then open http://localhost:8011/index.html
```

No build step, no dependencies, no package.json. Edit a file, reload the page.

## What it is

A phone app for a ceramics hobbyist: every piece from wet clay through bisque and
glaze to finished and sold, with what each one cost to make. English and Chinese.
Built from `pottery_app_spec.md` (sent over WeChat, not in the repo); see `README.md`
for the feature list and `mockup.html` for the design thinking behind the current
layout.

## The files

| File | What's in it |
| --- | --- |
| `index.html` | The shell: header, `#main`, tab bar, sheet, toast. Everything else is drawn by JS. |
| `i18n.js` | Every visible string in `en` and `zh`. `t("key")`, and `label(prefix, value)` for values that may be a built-in key or something the user typed. |
| `store.js` | The data: `DB` in localStorage, photos and daily snapshots in IndexedDB, merging of two copies, `Sync`, `Backups`, `migrate()`. |
| `cloud.js` | Supabase auth, pull/push of the `pottery` row, photo upload, reading `pottery_backups`. Plain `fetch`, no SDK. |
| `app.js` | All the screens. `VIEWS.<route>` returns HTML; `render()` draws the current route. ~1100 lines, the only big file. |
| `styles.css` | Cream/brown light theme and a warm dark theme, both minimal: hairlines, panels, no shadows. |
| `sw.js` | Network-first service worker so an installed phone always opens the latest version. |
| `mockup.html` | Static sketch of the simplified design, kept for reference. |

## How the UI works

- **Routing** is the hash: `#/pieces`, `#/piece/<id>`, `#/firing/<id>`, `#/purchase/<id>`,
  `#/ideas`, `#/costs`, `#/more`. `TABS` is the bottom bar; `TAB_OF` maps a detail
  route back to its tab (which is what shows the back arrow).
- **Editing**: an input carries `data-f="path.in.record"` and saves as you type without
  redrawing — only the computed figures (`data-calc`) refresh. Buttons carry
  `data-act` and redraw, keeping scroll position. The record comes from the nearest
  `[data-rec][data-coll][data-id]`.
- **A piece** is one stage at a time: `PIECE_TABS` (Greenware, Bisque, Glazed, Final,
  Design, Cost) swap `TAB_BODY[tab](piece, calc, unit)` underneath. A dot marks tabs
  that already have something in them.
- **Gestures**: swipe a row left for Delete (`swipeable()` wraps it), hold a photo tile
  or a tag for the same (`data-hold="<coll>:<id>"`, `longPress()`).

## The data

```
DB = { pieces, firings, designs, insps, purchases, shapes,   // maps of id -> record
       lists: { tags, clay, glazes, channels, studios, stores },  // value -> time added
       deleted: { "pieces:<id>": time } }                    // tombstones, kept 90 days
```

Every record has `id`, `createdAt`, `updatedAt`. Two copies merge record by record:
the more recently saved wins, a tombstone newer than a record keeps it deleted.
Device preferences (`SETTINGS`: language, currency, unit, layout) live apart and
never sync.

Things worth knowing before changing the shape of a record:

- **Measurements** live in `<stage>.m.<key>` where the keys come from the piece's
  shape (`SHAPES`, or a custom one in `DB.shapes`). `mget()` falls back to the older
  `l`/`w`/`h` fields, so pieces logged before shapes still read correctly.
- **Stages** are `wet` (as thrown), `trim` (after trimming), `bisque`, `final`.
- `migrate()` in `store.js` fixes up older records on load. It already carries the
  trimmed weight from `wet.trimmed` to `trim.weight`, and old single-item purchases
  into `items[]`. **Add to it rather than renaming a field in place** — renaming one
  without a migration is how the trimmed weights went missing once.
- **Costs**: `rateFor(kind, name)` averages what's been paid per gram across all
  orders, including each line's share of that order's delivery. `pieceCost(p)` charges
  clay and glaze at those rates and adds an equal share of any linked firing's fee and
  travel.

## Supabase

Shared project with Bùbù and Cheat Days (`cthoynfsgpqgthxpmngm`), one login for all
three. The anon key in `supabase-config.js` is the public client key; row-level
security is what protects the data. **Never put the service_role key in this repo.**

Already set up, no action needed: table `pottery`, table `pottery_backups` with its
trigger, and the shared public `photos` bucket (this app writes to
`<user id>/pottery/`). The SQL for all of it is in `README.md` if it ever needs
rebuilding.

A free project pauses after about a week of no activity — data intact, sign-in fails
until it's resumed in the dashboard.

## Deploying

`git push` to `master`; GitHub Pages serves the repo root and takes a minute or two.
Installed phones update themselves on next open (network-first worker, plus a
fingerprint check when the app returns from the background). Bumping the `?v=` numbers
in `index.html` and `CACHE` in `sw.js` is habit, not a requirement; `APP_VERSION` in
`app.js` is what Settings shows, and is the quickest way to tell whether a phone is
running the newest code.

The old panelled design is kept on the `backup-v7-panels` branch and the `v7-panels`
tag, if that look is ever wanted back.

## How it's been tested

No test framework. Changes are checked by serving locally, driving the page in a
browser (seeding records through the console, firing real touch events for the
gestures) and reading back the computed values — for example that £15 delivery across
£60/£35/£30 of goods lands as £7.20/£4.20/£3.60. Worth keeping that habit: the cost
and shrinkage maths is where a silent mistake would hurt most.

## Open threads

- The first **cloud backup** appears once the data changes after the trigger was
  installed (29 Sept 2026). Worth confirming Settings lists one.
- **Glaze cost** needs "Glaze used (g)" on the Glaze tab; without it glaze stays out of
  the total.
- Photos of **deleted pieces** stay in Supabase Storage. Deliberate for now (a deletion
  can be undone from a backup), but it means storage only grows.
- The **piece editor** is the busiest screen and has had several rounds of
  simplification. If it grows again, the pattern that worked was: fewer things visible
  at once, plain rows, and an option only appearing once it's relevant.
