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

All paths are under `/#/plan`. Route labels and paths are declared in `src/planner/routes.ts`.

| Route | What it does |
| --- | --- |
| `/plan` (Now) | What is due, what is waiting and what is next, at a glance. |
| `/plan/show` (Show) | Run of show with computed start times, the clock bar, piece roll-ups, and Publish to timer. |
| `/plan/show/print` (Print) | Printable run of show with switch cues, header and totals. Letter size. |
| `/plan/awards` (Awards) | Awards and contenders. `?tab=pieces` shows all pieces, with steps and "waiting on". |
| `/plan/films` (Films & ideas) | The film pool and the ideas inbox. |
| `/plan/people` (People) | People and invitations. The RSVP inbox is a tab here. |
| `/plan/logistics` (Logistics) | Venue options, open questions and the checklist. |
| `/plan/templates` (Task templates) | Edit and reorder reusable production checklists for the selected season. |
| `/plan/season` (Season) | Create a season, edit its settings, and start a season from the previous one. |
| `/plan/import` (Import) | One-time imports of the archive and CSV season files. |

## Data model

All record types are in `src/planner/types.ts`, which is the source of truth. Paths and helpers are in `src/planner/firestore.ts`.

- `seasons/{year}`: season settings (show date, start time, runtime cap, buffer target, `timerDocId`).
- `seasons/{year}/segments`, `awards`, `pieces`, `invitations`, `venues`, `questions`, `checklist`, `films`, `ideas`, `publishes`.
- `people/{personId}`: shared across seasons. Invitations are keyed by person id.
- `rsvps/{id}`: public form submissions, with planner-only `processed` and `matchedPersonId`.
- `showConfigs/{timerDocId}`: the Backstage Timer's document. Owned by the timer; the planner writes it only through Publish.

Times of day are `'HH:MM'`, durations are whole seconds (`...Sec` fields), dates are `'YYYY-MM-DD'`.

## Yearly workflow

1. **First time only: Import** (`/plan/import`). Loads the 2026 archive from Firestore and CSV files. Each card previews before it writes, and re-importing does not duplicate records.
2. **Each year: Season** (`/plan/season`). Use "Start {year} from {previous}". It copies returning awards, Sean's and house segments, last year's confirmed guests and draft contributor pieces into the new season. It only creates missing records, so it is safe to re-run, for example after importing more of last year's data.
3. **Season files** (`/plan/import`, season cards). Import films, venues, ideas, questions and similar CSVs into the season picked at the top of the page.
4. Then work in Awards, Show, People and Logistics through the year.

## RSVPs

The public form (`src/pages/RSVP.tsx`) still sends the Formspree email, which stays the source of truth. It also adds a document to the `rsvps` collection. That write is best-effort and failures are only logged.

Process them in People, RSVP inbox. Each RSVP shows a suggested person match (by email, name or alias). Apply does the following:

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

On the Show screen, Publish to timer opens a dialog.

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
npm run dev     # local server, port 5173
npm test        # Vitest
npm run lint
npm run build   # tsc -b && vite build
```

- Pushing to `main` deploys the whole site to GitHub Pages (`.github/workflows/deploy.yml`). Work on a branch and merge deliberately.
- Planner styles live in `src/planner/planner.css`; every class starts with `pl-`.
- Pure logic goes in `src/planner/logic/` with a `*.test.ts` beside it. Tests use invented data only.
- Keep `lint`, `build` and `test` green, and check that the public pages and `/#/timer` still load.
- The GitHub repo is public. `planning/` (specs and real data) is local-only, excluded through `.git/info/exclude`, and must never be committed. Never copy guest names, emails, venue terms, passcodes or hashes from it into tracked files.

## Production task templates

Task templates (`/plan/templates`) define the starting checklist for each production type: award video, song/parody, slides/bit, contributor presentation and other. Add, rename, remove or reorder tasks, then **Save template**. At least one named task is required. Unsaved drafts are kept in the current browser tab so switching types or navigating away does not lose them.

Templates are stored in `seasons/{year}.pieceTemplates` as a partial map from piece kind to `{key, label}[]`. Missing kinds use the original defaults. Saved templates are shared with other planner devices; no new Firestore rules are needed. Starting a season from the previous one copies its templates. New pieces, idea-to-piece creation, RSVP contributor pieces and rollover contributor drafts use these defaults. Historical archive imports retain their original completed checklists.

A piece keeps its own steps and progress. Updating a template never changes existing pieces. **Save checklist as reusable default** in a piece's panel copies its task labels and keys without copying progress. Renaming/reordering template tasks preserves keys such as `winner-decided`, `submitted`, `checked…` and `in-master-deck`, which dependency and revision logic use. Removing these milestones removes their specialized behavior (delivery falls back to the final step).

Now-screen links to Logistics scroll to, focus and highlight the relevant question, venue or checklist row.
