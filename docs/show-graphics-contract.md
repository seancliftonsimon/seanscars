# Show graphics contract

The agreement between the planner in `seancliftonsimon/seanscars` (Firestore, `seasons/{year}/awards`) and the show files in the private `seanscars-award-presentation` repo (`data/awards/*.json`). The same file lives in both repos; change both copies together, one change at a time.

## Principle

Nothing is in production yet, so formats change outright: no backwards-compatibility shims, just update every reader.

The awards are jokes and their rules are whatever the host says. Ties, winners who weren't nominated, the same performance nominated twice and any number of nominees are all allowed. A check may **warn** about what won't fit on screen; it never **refuses** an award for being unconventional. The only hard limits are what no layout can draw.

## Who owns what

Award content can be edited in either place. `npm run sync` (presentation repo) copies the shared fields both ways. When both sides changed the same field since the last sync, the newer edit wins.

| Show field | Planner field | Notes |
| --- | --- | --- |
| `id` | `Award.slug` | Set once, never regenerated from the name |
| `category.title` | `Award.name` | |
| `category.descriptor` | `Award.recognizes` | |
| `category.shortName` | `Award.shortName` | Warn above 40 characters |
| `category.year` | Season year | Planner to show only |
| `presentation.variant` | `Award.variant` | `standard` (missing means this), `film-only` or `honoree`. Picks the frame only. |
| `nominees[]`, in order | Contenders with `nominee: true`, in contender order | |
| `nominees[].id` | `Contender.slug` | |
| `nominees[].name` | `Contender.personName` | |
| `nominees[].film` | `Contender.film`, else the title of the film `filmId` links | |
| `nominees[].caption` | `Contender.caption` | |
| `winners[]` | `Award.winnerContenderIds` | A nominated winner is `{nomineeId}`. A contender with `nominee: false` who won is a surprise winner `{id, name, film, caption}`. |
| `honorees[]` | Contenders with `nominee: true`, for `honoree` awards | 1 or 2 |

- **Show only:** `media` (pictures, crops, focal points), `copy.*`, `timing.*`, `audio.*`, `presentation.includeRecap`, `status`. A surprise winner's picture follows its slug.
- **Planner only:** `stage`, `returning`, `notes`, `segmentId`, pieces, contender `note`, contenders that are neither nominees nor winners.
- **New awards** on either side are created on the other. A show-created award arrives in the planner at the end of the list, stage `nominees` (or `winner` if it has winners).
- **Deletes are never synced.** The sync reports them.
- **Show order** (`data/runs/*.json`) belongs to the show editor. The sync only appends cues for new awards, copying boundaries from their neighbours.

## Planner fields (all optional)

- `Award`: `variant`, `shortName`, `slug`, and `winnerContenderIds`, which replaces `winnerContenderId` everywhere.
- `Contender`: `personName`, `film`, `caption`, `slug`.
- `label` stays, written on save as `personName — film` (an em dash with spaces), or whichever of the two exists.

## Award format (show schema 2)

- `winners`: zero or more entries. Each is `{nomineeId}` or a surprise winner `{id, name?, film?, caption?, media?}`.
- Competitive awards (`standard`, `film-only`) need at least one nominee. Each nominee and surprise winner needs a name or a film.
- Nominee IDs are unique. A winner may not be listed twice, and a surprise winner's ID may not reuse a nominee's ID.
- Honoree awards take 1 or 2 honorees and no winners.
- `source: {planner: {season, awardId}}` records where a synced award came from.
- Warnings, never errors: more than 7 nominees, more tied winners than the tie layout holds, very long names.

## IDs

- Slugs are lowercase kebab-case (`^[a-z0-9]+(?:-[a-z0-9]+)*$`), unique within a season.
- Award slug: `<kebab name>-<year>`, for example `best-sheep-2027`.
- Contender slug: from the person name, else the film. A clash, such as the same performance twice, gets `-2`, `-3` and so on.
- The planner assigns missing slugs on save; the sync assigns them for awards created in the show editor. After that, only an explicit rename changes a slug, so renaming never breaks a run cue.

## Sync rules

1. Dry run by default; `--write` applies.
2. Three-way merge per award and per field against the snapshot from the last sync (`.sync/<season>.json`). The first sync has no snapshot, so the planner wins.
3. Before writing to the planner, back up its awards to `.sync/backups/`. Planner writes are field-level, with `updatedBy: 'show-sync'`.
4. Show files are written through `saveEntry` (`server/content-files.ts`). It checks the revision and the whole file, and refuses a change that would break the show run.

## Units

The planner counts whole seconds (`...Sec`). Show timing counts show frames at 30 per second; output is rendered at 60 fps.

## Privacy

`seanscars` is a public repo: tests and seed data there use invented names only. Winners live in the planner's Firestore, which anyone can read; that trade-off is accepted. Never commit real results to the public repo.
