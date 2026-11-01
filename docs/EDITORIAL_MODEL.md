# Editorial model

Reliability matters more than volume. Every historical record carries **three independent axes**. None is ever computed from another.

| Axis | Values | Answers | Where it lives |
|---|---|---|---|
| **Historical review** | `PENDING_REVIEW` · `IN_REVIEW` · `VERIFIED` · `NEEDS_REVISION` | Has a qualified reviewer checked this against its sources? | DB `editorial_records` (+ `editorial_log`); bundled defaults in `src/editorial/records.ts` |
| **Account classification** | `ESTABLISHED` · `DISPUTED` · `UNCERTAIN` | How do the sources present the account? | Derived from the existing certainty labels (timeline events, biography claims); unset (`null`) elsewhere; reviewer-editable |
| **Translation status** (fr / en / es, each) | `DRAFT` · `IN_REVIEW` · `APPROVED` | Has a language reviewer approved this translation? | Existing translation workflow (`entity_translations`, packs). Arabic is the original and has none |

Consequences, all enforced in code **and** tested:
- An `ESTABLISHED` account is never `VERIFIED` automatically. Verifying is an explicit reviewer action.
- A verified Arabic record does not approve any translation; an approved translation does not verify history. Editing a translation does not un-verify the Arabic record.
- `PENDING_REVIEW → VERIFIED` is not allowed. A record must first be `IN_REVIEW`.

## Records
Ids: `entity:<id>` (53) · `stage:<gN>` (17) · `biography:<id>` (2) · `claim:<bio>:<claimId>` (76) = **148**. Built from the existing data by `src/editorial/records.ts`; no id was changed.

## VERIFIED requires
reviewer identity **and** role · review date · at least one reviewed source (one of *this record's* sources) · review notes.
Same rule in `verifiedProblems()` (TypeScript) and in the SQL constraint `editorial_verified_needs_review_data`. Reviewer name and date are set by the server, not typed in. Leaving `VERIFIED` clears these fields (the history keeps them).

| From | Allowed to |
|---|---|
| PENDING_REVIEW | IN_REVIEW |
| IN_REVIEW | VERIFIED · NEEDS_REVISION · PENDING_REVIEW |
| NEEDS_REVISION | IN_REVIEW · PENDING_REVIEW |
| VERIFIED | IN_REVIEW · NEEDS_REVISION |

Roles: an **editor** can start a review, withdraw it, and add notes. A **reviewer** can also verify, return for revision (notes required) and change a classification (notes required; a VERIFIED record must be reopened first).

## Source references (`SourceRef`, `src/editorial/types.ts`)
`work · author · kind · locator · chapter · volume · page · hadithNo · verse · edition · publisher · url · passage{text, verified} · supports[] (record ids) · completeness`.
- Existing chapter-level references are **kept verbatim** (`locator`, `chapter`) and are `incomplete`. Authors are filled from the work's title only; nothing else is filled in.
- Complete = Qur'ān: sūra **and** āya; other works: an edition **and** a page or hadith number.
- A passage counts only with `verified: true`. None exists today.
- The public app shows an "incomplete" tag on every chapter-level reference.

## Legacy fields
The earlier per-language `verification` (`DISPUTED`, `UNCERTAIN` mixed with review states) is **legacy**: still accepted, never offered as a review state to readers. All current values are `PENDING_REVIEW`. Migration path: reviewers record decisions in `editorial_records`; the public app does not read that table yet (see below).

## Backlog
`src/editorial/backlog.ts`: Banū Qaynuqāʿ, Banū al-Naḍīr, Banū Qurayẓa, Bayʿat al-Riḍwān, ʿUmrat al-Qaḍāʾ — names only, **no dates, accounts or outcomes**. Required steps are listed there and in the dashboard.

## What is local, what is in the database
| Piece | Status |
|---|---|
| Records, classification defaults, source registry, rules, backlog, audit | Local files, bundled |
| `editorial_records`, `editorial_log`, `set_editorial_review`, `add_editorial_note` (+ RLS) | SQL in `supabase/schema.sql`, **tested only in PGlite** (in-process Postgres) |
| Dashboard "Historical review" / "Backlog" tabs | Implemented; browser-tested against a PGlite-backed **mock** of the API |
| Public app reading review decisions from the database | **Not implemented** — the public app still shows PENDING_REVIEW everywhere |
| Live Supabase project | **Never tested** |
