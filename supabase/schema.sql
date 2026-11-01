-- Content is public-read; progress is per-user. Run in the Supabase SQL editor.
create extension if not exists pg_trgm;

create table entities (
  id        text primary key,
  kind      text not null check (kind in ('person','event','place','group')),
  name      text not null,
  period    text not null check (period in ('pre','mecca','hijra','medina')),
  "when"    text not null default '',
  y         real not null default 0,          -- CE year, for ordering
  summary   text not null default '',
  bio       text not null default '',
  context   text not null default '',
  sources   jsonb not null default '[]',      -- [[title, ref], ...]
  rel       text[] not null default '{}',     -- related entity ids (map edges)
  disputed  text,                             -- null = established; text = what is disputed
  kw        text
);
create index on entities (kind, period, y);
create index on entities using gin ((name || ' ' || summary) gin_trgm_ops);

create table progress (
  user_id   uuid not null default auth.uid() references auth.users on delete cascade,
  entity_id text not null,
  viewed_at timestamptz not null default now(),
  primary key (user_id, entity_id)
);

alter table entities enable row level security;
alter table progress enable row level security;
create policy "public read" on entities for select using (true);
create policy "own progress" on progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============ Translation review and historical verification are INDEPENDENT tracks ============
-- Upgrading from an earlier version of this file: drop table entity_translations, entity_verification cascade; then re-run this file and supabase/seed.sql.

-- Translations: same entity id in every language (Arabic is the source in `entities`).
-- fields: {"name","when","summary","bio","context","disputed","sources":[[title, ref], ...]}
-- Only translation_status = 'reviewed' rows are publicly readable; drafts stay hidden from anon/authenticated.
create table entity_translations (
  entity_id                text not null references entities(id) on delete cascade,
  lang                     text not null check (lang in ('fr','en','es')),
  fields                   jsonb not null default '{}',
  translation_status       text not null default 'draft' check (translation_status in ('draft','submitted','reviewed','rejected')),
  translation_reviewed_by  text,
  translation_reviewed_at  timestamptz,
  last_edited_by           uuid,         -- author of the current text (set by save_translation)
  submitted_by             uuid,         -- who sent it to review (four-eyes: neither may approve it)
  updated_at               timestamptz not null default now(),
  primary key (entity_id, lang),
  constraint translation_reviewed_needs_reviewer
    check (translation_status <> 'reviewed' or (translation_reviewed_by is not null and translation_reviewed_at is not null))
);

-- Historical verification of the text in each language (incl. the Arabic original).
-- A missing row means PENDING_REVIEW. Anything else needs a named reviewer, a date and at least one supporting reference.
create table entity_verification (
  entity_id    text not null references entities(id) on delete cascade,
  lang         text not null check (lang in ('ar','fr','en','es')),
  status       text not null default 'PENDING_REVIEW' check (status in ('VERIFIED','DISPUTED','UNCERTAIN','PENDING_REVIEW')),
  reviewed_by  text,
  reviewed_at  timestamptz,
  note         text,
  refs         jsonb not null default '[]',   -- supporting references: [{"title","ref"}, ...]
  primary key (entity_id, lang),
  constraint verification_needs_reviewer
    check (status = 'PENDING_REVIEW' or (reviewed_by is not null and reviewed_at is not null and jsonb_array_length(refs) > 0))
);

alter table entity_translations enable row level security;
alter table entity_verification enable row level security;
create policy "public read reviewed translations" on entity_translations for select using (translation_status = 'reviewed');
create policy "public read verification" on entity_verification for select using (true);
-- No insert/update/delete policies on any table: writes happen only through the editorial functions below (or the service role, never shipped to the browser).

-- ============ Editorial dashboard (admin.html) ============
-- Who may use it: Supabase Auth users who have a row in `reviewers`. Signing up alone grants nothing.
--   editor   : save drafts, submit for review, add notes
--   reviewer : everything an editor can + approve/reject translations + set historical verification
-- Grant access (SQL editor, service role):
--   insert into reviewers (user_id, role, display_name) select id, 'reviewer', 'Full Name' from auth.users where email = 'x@y.z';
-- Translation review and historical verification are separate functions and never change each other.
create table reviewers (
  user_id      uuid primary key references auth.users on delete cascade,
  role         text not null check (role in ('editor','reviewer')),
  display_name text not null check (length(trim(display_name)) > 0)   -- recorded as reviewed_by
);

-- Append-only revision history + reviewer notes, written only by the functions below.
create table review_log (
  id         bigint generated always as identity primary key,
  entity_id  text not null references entities(id) on delete cascade,
  lang       text not null check (lang in ('ar','fr','en','es')),
  track      text not null check (track in ('translation','verification')),
  action     text not null,                 -- save | submit | approve | reject | verify | note
  status     text,                          -- status after the action
  fields     jsonb,                         -- snapshot (translation fields, or {refs} for verification)
  note       text,
  actor      uuid not null,
  actor_name text not null,
  at         timestamptz not null default now()
);
create index on review_log (entity_id, lang, at desc);

alter table reviewers enable row level security;
alter table review_log enable row level security;

create function reviewer_role() returns text language sql stable security definer set search_path = public as
  $$ select role from reviewers where user_id = auth.uid() $$;

create policy "read own reviewer row" on reviewers for select using (user_id = auth.uid());
create policy "staff read all translations" on entity_translations for select using (reviewer_role() is not null);
create policy "staff read review log" on review_log for select using (reviewer_role() is not null);

create function _actor(need text) returns reviewers language plpgsql stable security definer set search_path = public as $$
declare r reviewers;
begin
  select * into r from reviewers where user_id = auth.uid();
  if not found or (need = 'reviewer' and r.role <> 'reviewer') then raise exception 'not authorized' using errcode = '42501'; end if;
  return r;
end $$;

create function _log(p_entity text, p_lang text, p_track text, p_action text, p_status text, p_fields jsonb, p_note text, a reviewers) returns void
language sql security definer set search_path = public as
  $$ insert into review_log (entity_id, lang, track, action, status, fields, note, actor, actor_name) values (p_entity, p_lang, p_track, p_action, p_status, p_fields, nullif(trim(p_note), ''), a.user_id, a.display_name) $$;

-- Editing ALWAYS puts the text back to draft and clears any approval: approved wording can never change silently.
create function save_translation(p_entity text, p_lang text, p_fields jsonb, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a reviewers := _actor('editor');
begin
  if jsonb_typeof(p_fields) <> 'object' or exists (select 1 from jsonb_object_keys(p_fields) k where k not in ('name','when','summary','bio','context','disputed','sources'))
    then raise exception 'invalid fields'; end if;
  if coalesce(trim(p_fields->>'name'), '') = '' then raise exception 'name is required'; end if;
  insert into entity_translations (entity_id, lang, fields, translation_status, last_edited_by, submitted_by, updated_at)
    values (p_entity, p_lang, p_fields, 'draft', a.user_id, null, now())
  on conflict (entity_id, lang) do update set fields = excluded.fields, translation_status = 'draft', translation_reviewed_by = null,
    translation_reviewed_at = null, last_edited_by = a.user_id, submitted_by = null, updated_at = now();
  perform _log(p_entity, p_lang, 'translation', 'save', 'draft', p_fields, p_note, a);
end $$;

create function submit_translation(p_entity text, p_lang text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a reviewers := _actor('editor'); t entity_translations;
begin
  select * into t from entity_translations where entity_id = p_entity and lang = p_lang for update;
  if not found or t.translation_status <> 'draft' then raise exception 'only a saved draft can be submitted'; end if;
  if coalesce(trim(t.fields->>'summary'), '') = '' or coalesce(trim(t.fields->>'bio'), '') = '' then raise exception 'summary and biography are required'; end if;
  update entity_translations set translation_status = 'submitted', submitted_by = a.user_id, updated_at = now() where entity_id = p_entity and lang = p_lang;
  perform _log(p_entity, p_lang, 'translation', 'submit', 'submitted', null, p_note, a);
end $$;

-- Approve / reject. Four-eyes: the reviewer must be neither the last editor nor the submitter. Never automatic.
create function review_translation(p_entity text, p_lang text, p_decision text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a reviewers := _actor('reviewer'); t entity_translations;
begin
  if p_decision not in ('approve','reject') then raise exception 'decision must be approve or reject'; end if;
  select * into t from entity_translations where entity_id = p_entity and lang = p_lang for update;
  if not found or t.translation_status <> 'submitted' then raise exception 'only a submitted translation can be reviewed'; end if;
  if a.user_id in (t.last_edited_by, t.submitted_by) then raise exception 'a different reviewer must review text you edited or submitted'; end if;
  if p_decision = 'reject' then
    if coalesce(trim(p_note), '') = '' then raise exception 'a rejection needs a reviewer note'; end if;
    update entity_translations set translation_status = 'rejected', updated_at = now() where entity_id = p_entity and lang = p_lang;
    perform _log(p_entity, p_lang, 'translation', 'reject', 'rejected', null, p_note, a);
  else
    update entity_translations set translation_status = 'reviewed', translation_reviewed_by = a.display_name, translation_reviewed_at = now(), updated_at = now() where entity_id = p_entity and lang = p_lang;
    perform _log(p_entity, p_lang, 'translation', 'approve', 'reviewed', null, p_note, a);
  end if;
end $$;

-- Historical verification: independent of translation status. p_refs = [{"title","ref"}, ...]
create function set_verification(p_entity text, p_lang text, p_status text, p_refs jsonb, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a reviewers := _actor('reviewer');
begin
  if p_status not in ('VERIFIED','DISPUTED','UNCERTAIN','PENDING_REVIEW') then raise exception 'invalid status'; end if;
  if jsonb_typeof(p_refs) <> 'array' then raise exception 'refs must be an array'; end if;
  if p_status <> 'PENDING_REVIEW' then
    if jsonb_array_length(p_refs) = 0 or exists (select 1 from jsonb_array_elements(p_refs) r where jsonb_typeof(r) <> 'object' or coalesce(trim(r->>'title'), '') = '')
      then raise exception 'at least one supporting reference (with a title) is required'; end if;
    if p_status in ('DISPUTED','UNCERTAIN') and coalesce(trim(p_note), '') = '' then raise exception 'explain what is %', lower(p_status); end if;
  end if;
  insert into entity_verification (entity_id, lang, status, reviewed_by, reviewed_at, note, refs)
    values (p_entity, p_lang, p_status, case when p_status <> 'PENDING_REVIEW' then a.display_name end, case when p_status <> 'PENDING_REVIEW' then now() end, nullif(trim(p_note), ''), p_refs)
  on conflict (entity_id, lang) do update set status = excluded.status, reviewed_by = excluded.reviewed_by, reviewed_at = excluded.reviewed_at, note = excluded.note, refs = excluded.refs;
  perform _log(p_entity, p_lang, 'verification', 'verify', p_status, jsonb_build_object('refs', p_refs), p_note, a);
end $$;

create function add_review_note(p_entity text, p_lang text, p_track text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare a reviewers := _actor('editor');
begin
  if coalesce(trim(p_note), '') = '' then raise exception 'empty note'; end if;
  perform _log(p_entity, p_lang, p_track, 'note', null, null, p_note, a);
end $$;

revoke all on function _actor(text), _log(text,text,text,text,text,jsonb,text,reviewers), reviewer_role() from public;
revoke all on function save_translation(text,text,jsonb,text), submit_translation(text,text,text), review_translation(text,text,text,text),
  set_verification(text,text,text,jsonb,text), add_review_note(text,text,text,text) from public;
grant execute on function reviewer_role() to anon, authenticated; -- RLS policies call it as the querying role
grant execute on function save_translation(text,text,jsonb,text), submit_translation(text,text,text), review_translation(text,text,text,text),
  set_verification(text,text,text,jsonb,text), add_review_note(text,text,text,text) to authenticated;

-- ============ Historical editorial review (record level) ============
-- THREE independent axes: this table holds (1) the historical review status and (2) the classification of the account.
-- Translation status is NOT here: it stays in entity_translations / its own review. Changing one never changes another.
-- record_id: 'entity:<id>' | 'stage:<gN>' | 'biography:<id>' | 'claim:<bio>:<claimId>'  (ids are defined by src/editorial/records.ts).
-- A row exists only once someone has acted on a record; no row = PENDING_REVIEW with the classification bundled in the app.
create table editorial_records (
  record_id        text primary key,
  record_type      text not null check (record_type in ('entity','stage','biography','claim')),
  review_status    text not null default 'PENDING_REVIEW' check (review_status in ('PENDING_REVIEW','IN_REVIEW','VERIFIED','NEEDS_REVISION')),
  classification   text check (classification in ('ESTABLISHED','DISPUTED','UNCERTAIN')),
  reviewed_by      text,
  reviewer_role    text check (reviewer_role in ('editor','reviewer')),
  reviewed_at      timestamptz,
  reviewed_sources jsonb not null default '[]',   -- source ids (src/editorial/sources.ts) the reviewer actually checked
  review_notes     text,
  updated_at       timestamptz not null default now(),
  constraint editorial_verified_needs_review_data check (
    review_status <> 'VERIFIED' or (reviewed_by is not null and reviewer_role is not null and reviewed_at is not null
      and jsonb_array_length(reviewed_sources) > 0 and coalesce(trim(review_notes), '') <> ''))
);
create table editorial_log (
  id               bigint generated always as identity primary key,
  record_id        text not null,
  action           text not null,            -- review | classify | note
  from_status      text,
  to_status        text,
  classification   text,
  reviewed_sources jsonb,
  notes            text,
  actor            uuid not null,
  actor_name       text not null,
  at               timestamptz not null default now()
);
create index on editorial_log (record_id, at desc);
alter table editorial_records enable row level security;
alter table editorial_log enable row level security;
create policy "public read editorial status" on editorial_records for select using (true);   -- review status is public information
create policy "staff read editorial log" on editorial_log for select using (reviewer_role() is not null);

-- No PENDING_REVIEW -> VERIFIED shortcut: a record must be IN_REVIEW first. Only a reviewer can verify, return for revision or reclassify.
create function set_editorial_review(p_record text, p_type text, p_status text, p_classification text default null, p_sources jsonb default '[]', p_notes text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a reviewers; cur editorial_records; frm text; ok boolean;
begin
  select * into cur from editorial_records where record_id = p_record for update;
  frm := coalesce(cur.review_status, 'PENDING_REVIEW');
  a := _actor(case when p_status in ('VERIFIED','NEEDS_REVISION') or p_classification is not null then 'reviewer' else 'editor' end);
  ok := (frm, p_status) in (('PENDING_REVIEW','IN_REVIEW'),('IN_REVIEW','VERIFIED'),('IN_REVIEW','NEEDS_REVISION'),('IN_REVIEW','PENDING_REVIEW'),
        ('NEEDS_REVISION','IN_REVIEW'),('NEEDS_REVISION','PENDING_REVIEW'),('VERIFIED','IN_REVIEW'),('VERIFIED','NEEDS_REVISION'));
  ok := ok or (p_status = frm and p_classification is not null and frm <> 'VERIFIED'); -- reclassify without changing status (a VERIFIED record must be reopened first)
  if not ok then raise exception '% -> % is not an allowed review transition', frm, p_status; end if;
  if p_status = 'NEEDS_REVISION' and coalesce(trim(p_notes), '') = '' then raise exception 'returning a record for revision needs notes'; end if;
  if p_classification is not null and p_classification is distinct from cur.classification and coalesce(trim(p_notes), '') = '' then raise exception 'changing the classification needs notes'; end if;
  if p_status = 'VERIFIED' then
    if jsonb_typeof(p_sources) <> 'array' or jsonb_array_length(p_sources) = 0 then raise exception 'VERIFIED needs at least one reviewed source reference'; end if;
    if coalesce(trim(p_notes), '') = '' then raise exception 'VERIFIED needs review notes'; end if;
  end if;
  insert into editorial_records (record_id, record_type, review_status, classification, reviewed_by, reviewer_role, reviewed_at, reviewed_sources, review_notes, updated_at)
    values (p_record, p_type, p_status, p_classification,
            case when p_status = 'VERIFIED' then a.display_name end, case when p_status = 'VERIFIED' then a.role end, case when p_status = 'VERIFIED' then now() end,
            case when p_status = 'VERIFIED' then p_sources else '[]'::jsonb end, nullif(trim(p_notes), ''), now())
  on conflict (record_id) do update set review_status = excluded.review_status,
    classification = coalesce(excluded.classification, editorial_records.classification),
    reviewed_by = excluded.reviewed_by, reviewer_role = excluded.reviewer_role, reviewed_at = excluded.reviewed_at,
    reviewed_sources = excluded.reviewed_sources, review_notes = coalesce(excluded.review_notes, editorial_records.review_notes), updated_at = now();
  insert into editorial_log (record_id, action, from_status, to_status, classification, reviewed_sources, notes, actor, actor_name)
    values (p_record, case when p_classification is not null then 'classify' else 'review' end, frm, p_status, p_classification, case when p_status = 'VERIFIED' then p_sources end, nullif(trim(p_notes), ''), a.user_id, a.display_name);
end $$;

create function add_editorial_note(p_record text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare a reviewers := _actor('editor');
begin
  if coalesce(trim(p_note), '') = '' then raise exception 'empty note'; end if;
  insert into editorial_log (record_id, action, notes, actor, actor_name) values (p_record, 'note', trim(p_note), a.user_id, a.display_name);
end $$;

revoke all on function set_editorial_review(text,text,text,text,jsonb,text), add_editorial_note(text,text) from public;
grant execute on function set_editorial_review(text,text,text,text,jsonb,text), add_editorial_note(text,text) to authenticated;
