# Sharemony Planner

## What it is

The planner is a private working tool for running the yearly Sharemony show: run of show, awards, pieces, films and ideas, guests and RSVPs, venues and open questions. It lives inside the public site at `/#/plan` (HashRouter, so the full address is `<site>/#/plan`). The code is in `src/planner/`. It shares the site's Firebase project and publishes the run of show to the existing Backstage Timer (`/#/timer`).

## Access

The planner is behind a client-side passcode gate (`src/planner/hooks/usePlannerPasscode.ts`). The file stores only a SHA-256 hash of the passcode, and a browser that has unlocked once remembers it in localStorage.

To change the passcode, compute the hash of the new one:

```sh
printf '%s' 'new-passcode' | shasum -a 256
```

Replace the `PASSCODE_SHA256` constant with the result (the hex string only). Everyone must enter the new passcode afterward.

The gate only hides the UI. The planner collections are open in `firestore.rules`, the same trade-off as ballots, so anyone who calls Firestore directly can read and write them. Don't store anything secret in the planner. There is no sign-in and no per-user access list; `updatedBy` is just `'planner'`.

## Routes

All paths are under `/#/plan`. Labels and paths are declared in `src/planner/routes.ts`. The nav is organized by what you want to do; old paths redirect (with their query strings translated), so existing links keep working.

| Route | What it does |
| --- | --- |
| `/plan` (Home) | Countdown, the season's phase, the three things most worth doing next (with inline actions), and the blocks that matter in this phase. |
| `/plan/guests` (Guests) | Guest list with the projected headcount vs capacity (plus-ones counted). Views: `?view=send` (send invitations), `replies` (RSVP inbox), `waiting` (who hasn't replied, nudges), `final` (show-week numbers). `?person=` opens a guest. |
| `/plan/guests/door` | Printable alphabetical door list. |
| `/plan/show` (Show) | Clock verdict and the run of show as a timeline; Publish to timer. `?segment=<id or new>` opens a segment. |
| `/plan/show/ready` | Show-week readiness, Publish, Print and the timer switch steps. `?publish=1` opens Publish. |
| `/plan/show/print` | Printable run of show. Letter size. |
| `/plan/make` (Make) | My queue. `?view=awards`, `guests` (guest presentations), `pieces`. `?award=`, `?piece=` open a record. |
| `/plan/prep` (Venue & to-dos) | Venue options, open questions, checklist. `?view=venues|questions|checklist`; `?venue=`, `?question=`, `?task=` link to a record. |
| `/plan/ideas` (Ideas) | Ideas inbox; `?view=films` for the film pool. `?idea=`, `?film=` link to a record. |
| `/plan/season` (Season setup) | Setup checklist, season settings, start a season from the previous one. |
| `/plan/import` (Import) | One-time imports of the archive and CSV season files. |

Old paths: `/plan/people` → `/plan/guests` (`?tab=inbox` → `?view=replies`), `/plan/awards` → `/plan/make` (`?tab=pieces` → `?view=pieces`), `/plan/films` → `/plan/ideas?view=films`, `/plan/logistics` → `/plan/prep`.

Anywhere: Cmd/Ctrl-K (or `/`) searches every record and jumps; `C` opens quick add (idea, guest, task or question; "song: …" tags an idea); `G` then `H`/`G`/`S`/`M`/`V`/`I` jumps to a section; Ctrl/Cmd-Z undoes the last change that offered Undo.

## Phases

The home screen leads with what matters now, using a phase derived from the data (`src/planner/logic/phase.ts`):

- **Set up**: no show date, or no run of show, awards or guest list yet.
- **Build the lists**: no invitation sent yet. Reply counts stay off screen; the headline is the projected headcount if everyone listed says yes.
- **Invitations out**: at least one sent, more than four weeks to go, and over a quarter of sent invitations unanswered.
- **Production**: invitations out and the show is four weeks away or less, or most replies are in.
- **Show week**: seven days or less to go.
- **After the show**: the date has passed.

An invitation counts as sent once it has a sent date, is "Invited", or has a reply. The phase can be set by hand from Home (stored as `phaseOverride` on the season); "Automatic" goes back to the derived one. The relevance matrix in the same file decides what each phase shows as headline, supporting or hidden; hidden blocks are only left off Home and stay reachable from their screens.

## Data model

All record types are in `src/planner/types.ts`, which is the source of truth. Paths and helpers are in `src/planner/firestore.ts`.

- `seasons/{year}`: season settings (show date, start time, runtime cap, buffer target, `timerDocId`).
- `seasons/{year}/segments`, `awards`, `pieces`, `invitations`, `venues`, `questions`, `checklist`, `films`, `ideas`, `publishes`.
- Awards carry the fields the show graphics share (`docs/show-graphics-contract.md`): `variant` (`standard` if missing, `film-only`, `honoree`), `shortName`, `slug` (the Show ID, set once on first save) and `winnerContenderIds` (zero or more, so ties and winners who weren't nominated are fine). Contenders add `personName`, `film`, `caption` and `slug`; `label` is written on save as `personName — film`. The pure helpers are in `logic/showGraphics.ts`.
- `people/{personId}`: shared across seasons. Invitations are keyed by person id.
- `rsvps/{id}`: public form submissions, with planner-only `processed` and `matchedPersonId`.
- `showConfigs/{timerDocId}`: the Backstage Timer's document. Owned by the timer; the planner writes it only through Publish.

Times of day are `'HH:MM'`, durations are whole seconds (`...Sec` fields), dates are `'YYYY-MM-DD'`.

## Yearly workflow

1. **First time only: Import** (`/plan/import`). Loads the 2026 archive from Firestore and CSV files. Each card previews before it writes, and re-importing does not duplicate records.
2. **Each year: Season** (`/plan/season`). Use "Start {year} from {previous}". It copies returning awards, Sean's and house segments, last year's confirmed guests and draft contributor pieces into the new season. It only creates missing records, so it is safe to re-run, for example after importing more of last year's data.
3. **Season files** (`/plan/import`, season cards). Import films, venues, ideas, questions and similar CSVs into the season picked at the top of the page.
4. Then work from Home: Guests, Show, Make and Venue & to-dos through the year. Season setup shows what is left to set up.

## RSVPs

The public form (`src/pages/RSVP.tsx`) still sends the Formspree email, which stays the source of truth. It also adds a document to the `rsvps` collection. That write is best-effort and failures are only logged.

Process them in Guests, Replies (`/plan/guests?view=replies`); the nav shows a count from anywhere. Each RSVP shows a suggested person match (by email, name or alias). Apply does the following:

- Sets the invitation status from the answer and records the brunch choice, the response date and the RSVP id.
- Saves the RSVP email on the person if they had none.
- Optionally creates a draft contributor piece when the guest chose to present.
- Marks the RSVP processed.

Ignore marks it processed without changing anything else.

## Firestore rules

`firestore.rules` at the repo root is the source of truth. Firebase does not read it from the repo, so after editing it:

1. Copy the whole file.
2. Firebase console, Firestore, Rules, paste over the existing rules, Publish.
3. Check that the timer syncs (`/#/timer`) and that a vote submits.

The public RSVP form can only create well-formed `rsvps` documents. Everything else in the planner is open (see Access).

## Publishing to the Backstage Timer

On the Show screen (or Show week), Publish to timer opens a dialog.

- **Test vs live.** The target is the season's `timerDocId` (for example `seanscars-2027-rundown`) or its test copy, `{timerDocId}-test`. The dialog defaults to wherever the last publish went (the test copy before any publish), so writing to the live timer is always a deliberate choice.
- **Diff.** It compares the plan with the target document as it stands: segments added, removed, retimed or reordered, and the total before and after.
- **Timer-side edits.** If the timer has edited the document since the last publish, the dialog warns and lists those edits, because publishing overwrites them.
- Publishing overwrites the document (no merge, so removed segments disappear) and records the publish under `seasons/{year}/publishes`. The Show header then shows the last publish and whether the plan changed since.

How the timer behaves (`src/pages/BackstageTimer.tsx`, which the planner never changes):

- It reads `showConfigs/{VITE_RUN_OF_SHOW_DOC_ID}`.
- On load it adopts the cloud document only if its `updatedAtMs` is newer than the device's saved copy (localStorage key `seanscars-stage-timer-v1`). Publishing always sets `updatedAtMs` to the publish time.
- If the document does not exist, the timer creates it from its own defaults. Publish before anyone opens the timer on a new doc id.
- During the show the timer writes its own edits to the same document. After the final publish, show-night edits belong to the timer.

### Testing against the test document

```sh
VITE_RUN_OF_SHOW_DOC_ID=seanscars-2027-rundown-test npm run dev
```

Open `/#/timer`. If it shows old data, clear the `seanscars-stage-timer-v1` localStorage key (browser dev tools, Application, Local Storage) and reload.

## Show-week switch

Before the show, point the live timer at the new season:

1. In `.env`, change `VITE_RUN_OF_SHOW_DOC_ID` to the new season's doc id, for example `seanscars-2027-rundown`.
2. In the planner, publish once to the live document (choose "Live timer" in the dialog).
3. Push to `main`, which deploys the site.

`.env` is tracked (web config only). Never put secrets in it.

## Development

```sh
npm run dev       # local server, port 5173 (real Firebase project: careful)
npm run dev:fake  # same app on an in-memory fake with invented data
npm test        # Vitest
npm run lint
npm run build   # tsc -b && vite build
```

- `npm run dev:fake` swaps Firebase for `src/planner/dev/fakeFirestore.ts` (Vite `--mode fake`), so nothing reaches the real project. Pick a phase with `?scenario=` before the `#`: `empty`, `fresh`, `lists`, `invites` (default), `production`, `showweek`, `after`, e.g. `http://localhost:5173/?scenario=lists#/plan`. Edits persist for the tab; add `?reset` to start over. Seed data in `src/planner/dev/seed.ts` is invented; keep it that way. The passcode gate still applies.
- Pushing to `main` deploys the whole site to GitHub Pages (`.github/workflows/deploy.yml`). Work on a branch and merge deliberately.
- Planner styles live in `src/planner/planner.css`; every class starts with `pl-`.
- Pure logic goes in `src/planner/logic/` with a `*.test.ts` beside it. Tests use invented data only.
- Keep `lint`, `build` and `test` green, and check that the public pages and `/#/timer` still load.
- The GitHub repo is public. `planning/` (specs and real data) is local-only, excluded through `.git/info/exclude`, and must never be committed. Never copy guest names, emails, venue terms, passcodes or hashes from it into tracked files.
