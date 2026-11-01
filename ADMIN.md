# Content Review Dashboard

Separate page (`/admin.html`), not linked from the public app. Needs Supabase; the public app does not.

## One-time setup (Supabase project)
1. Run `supabase/schema.sql`, then `supabase/seed.sql` in the SQL editor.
2. Authentication → Providers → Email: **disable "Allow new users to sign up"** (accounts are created by an admin).
3. Authentication → Users → *Add user* (email + password).
4. Grant access (SQL editor): 
   `insert into reviewers (user_id, role, display_name) select id, 'reviewer', 'Full Name' from auth.users where email = 'x@y.z';`
   Roles: `editor` (save / submit / notes) and `reviewer` (also approve / reject / historical verification).
5. `.env`: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (anon key only), then `npm run dev` or `npm run build`.

Never put the service-role key in `.env` or any `VITE_*` variable; `npm test` fails if it appears in the source or build.

## Using it
Open `/admin.html` and sign in. Overview = progress; Review queue = pending / rejected / approved / draft translations; Entities = all 40 entities with the 4 languages' statuses, searchable and filterable.
Translation: edit → Save draft → Submit for review → a *different* reviewer approves or rejects (a rejection needs a note). Editing approved text withdraws its approval.
History: set status + at least one supporting reference (+ a note for DISPUTED / UNCERTAIN); reviewer name and date are recorded by the server. Independent of translation review.

## Historical review (separate from translation review)
Tabs **Historical review** and **Backlog**. Each of the 148 records (entities, stages, biographies, claims) has three independent axes — historical review, classification, per-language translation status. See `docs/EDITORIAL_MODEL.md`.
Workflow: open a record → compare the Arabic original with fr/en/es → inspect its source references → *Start review* (editor or reviewer) → a **reviewer** ticks the sources actually checked, writes notes, and marks **VERIFIED** — or returns it for revision with notes. Nothing is ever verified automatically, and PENDING_REVIEW cannot jump to VERIFIED.
Apply the new tables first: re-run `supabase/schema.sql` (adds `editorial_records`, `editorial_log` and two functions). The public app does not display these decisions yet.
