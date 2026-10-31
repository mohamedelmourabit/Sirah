# Biography pages

One page template (`src/BioPage.tsx`) renders any biography registered in `src/bio/index.ts`.

## Add the next Companion (e.g. Abu Bakr, id `abubakr`)
1. `src/bio/abubakr.ts` — copy `umar.ts`: `id` = the entity id in `src/data.ts`, `neighbors`, `sources` (Arabic title + locator), `facts`, `sections` → `claims` (each with `certainty`: established | disputed | uncertain, and `src` ids), `links` (existing entity ids only), `journey`.
2. `src/bio/abubakr/{ar,fr,en,es}.json` — same keys as the skeleton (see `umar/*.json`). `ar.json` is the original; fr/en/es are `"translation": {"status": "draft"}`; all four have `"verification": {"status": "PENDING_REVIEW"}`. Every source title needs a `books` entry and every locator a `refs` entry in fr/en/es.
3. `src/bio/index.ts` — add one entry (`abubakr: { def, load }`) next to `umar`.
4. `npm run check:bio` — fails on unknown entity ids, missing claims/translations/sources, wrong script, or any approval without a named reviewer + date.

Nothing else changes: the "Read the full biography" button, deep link `#/bio/<id>`, links, reading progress, recommendations and prev/next come from the template.
Rules: no invented dates/quotes/hadith; cite only sources you can name; unknown → `uncertain` or leave it out; never set VERIFIED/approved without a reviewer.
