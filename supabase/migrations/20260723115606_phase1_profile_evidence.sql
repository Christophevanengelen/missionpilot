-- Phase 1 / PR A — versioned professional profile + evidence library.
--
-- Conventions (identical to init_phase0_schema): RLS enabled in the same
-- migration as each CREATE TABLE; explicit `revoke all` then least-privilege
-- grants (column-scoped where relevant); `(select auth.uid())` in policies;
-- enums locked by CHECK constraints; fixed search_path on every function.
--
-- Write model for this vertical: interactive user data is written through
-- DAL-verified Server Actions using the SESSION client — RLS owner policies
-- are the second barrier. service_role/agent-ops is NOT used here; it keeps
-- privileges only for the future, documented privacy-erasure workflow.

-- ---------------------------------------------------------------------------
-- 1. profile_claims — the living interview state.
--
-- A claim is one statement about the profile. Corrections NEVER mutate the
-- value and NEVER reuse the `rejected` state to mean "replaced": a
-- replacement inserts a new claim (previous_claim_id) and closes the old one
-- (superseded_by_claim_id + superseded_at). A restore closes claims without
-- a successor (superseded_at only), so "active" means superseded_at IS NULL.
-- An *achievement* is a business claim (title/statement in `value`) backed
-- by evidence links — not a technical reference.

create table public.profile_claims (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null
    references public.candidate_profiles (id) on delete cascade,
  kind text not null check (
    kind in (
      'role', 'seniority', 'summary', 'years_experience', 'skill',
      'achievement'
    )
  ),
  value jsonb not null check (jsonb_typeof(value) = 'object'),
  state text not null default 'proposed'
    check (state in ('proposed', 'confirmed', 'needs_review', 'rejected')),
  origin text not null default 'user' check (origin in ('user', 'assistant')),
  previous_claim_id uuid references public.profile_claims (id),
  superseded_by_claim_id uuid references public.profile_claims (id),
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A successor implies a closure timestamp (closures without successor are
  -- legal: restore).
  check (superseded_by_claim_id is null or superseded_at is not null)
);

create index profile_claims_profile_idx
  on public.profile_claims (profile_id, kind);

-- Chain-integrity guard (second barrier under direct PostgREST access):
-- chain references must stay inside the SAME profile, and a closed claim can
-- never be silently reopened. Lifecycle-state legality remains app-enforced
-- (documented decision) — this trigger protects only the history's shape.
create or replace function public.enforce_claim_chain_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.previous_claim_id is not null then
    if not exists (
      select 1 from public.profile_claims c
      where c.id = new.previous_claim_id
        and c.profile_id = new.profile_id
        and c.kind = new.kind
    ) then
      raise exception
        'previous_claim_id must reference the same profile and kind';
    end if;
  end if;
  if new.superseded_by_claim_id is not null then
    if not exists (
      select 1 from public.profile_claims c
      where c.id = new.superseded_by_claim_id
        and c.profile_id = new.profile_id
        and c.kind = new.kind
    ) then
      raise exception
        'superseded_by_claim_id must reference the same profile and kind';
    end if;
  end if;
  if tg_op = 'UPDATE' then
    if old.superseded_at is not null and new.superseded_at is null then
      raise exception 'a closed claim cannot be reopened';
    end if;
    if old.superseded_by_claim_id is not null
       and new.superseded_by_claim_id is distinct from old.superseded_by_claim_id then
      raise exception 'a claim successor cannot be rewritten';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_claim_chain_integrity()
  from public, anon, authenticated;

create trigger profile_claims_chain_integrity
  before insert or update on public.profile_claims
  for each row execute function public.enforce_claim_chain_integrity();

-- Single-valued kinds keep at most one ACTIVE claim.
create unique index profile_claims_one_active_single_valued
  on public.profile_claims (profile_id, kind)
  where superseded_at is null
    and kind in ('role', 'seniority', 'summary', 'years_experience');

alter table public.profile_claims enable row level security;

create trigger profile_claims_set_updated_at
  before update on public.profile_claims
  for each row execute function public.set_updated_at();

create policy "owner can read own claims"
  on public.profile_claims for select
  to authenticated
  using (
    exists (
      select 1 from public.candidate_profiles p
      where p.id = profile_id and p.user_id = (select auth.uid())
    )
  );

create policy "owner can add claims to own profile"
  on public.profile_claims for insert
  to authenticated
  with check (
    exists (
      select 1 from public.candidate_profiles p
      where p.id = profile_id and p.user_id = (select auth.uid())
    )
  );

create policy "owner can update own claims"
  on public.profile_claims for update
  to authenticated
  using (
    exists (
      select 1 from public.candidate_profiles p
      where p.id = profile_id and p.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.candidate_profiles p
      where p.id = profile_id and p.user_id = (select auth.uid())
    )
  );

revoke all on public.profile_claims from anon, authenticated;
grant select, insert on public.profile_claims to authenticated;
-- Values are append-only: users may change lifecycle state and close a claim
-- when replacing it — never rewrite `value`, `kind` or the chain origin.
grant update (state, superseded_by_claim_id, superseded_at, updated_at)
  on public.profile_claims to authenticated;
grant select, insert, update, delete on public.profile_claims to service_role;

-- ---------------------------------------------------------------------------
-- 2. evidence_items — the profile's living evidence library.
--
-- Owner-approved deviation from DOMAIN_MODEL's `profileVersionId`: evidence
-- belongs to the PROFILE (a living library); published versions embed the
-- relevant evidence content in their snapshot, so later edits here never
-- rewrite an old version's meaning.

create table public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null
    references public.candidate_profiles (id) on delete cascade,
  type text not null check (
    type in (
      'achievement', 'responsibility', 'skill', 'domain', 'metric',
      'testimonial', 'credential', 'portfolio_case'
    )
  ),
  title text not null check (char_length(title) between 1 and 300),
  statement text not null check (char_length(statement) between 1 and 5000),
  organization text,
  start_date date,
  end_date date,
  metrics jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metrics) = 'object'),
  tags text[] not null default '{}',
  source_type text not null check (
    source_type in ('user_stated', 'document', 'url', 'import')
  ),
  source_reference text,
  verification_status text not null default 'user_confirmed' check (
    verification_status in ('imported', 'user_confirmed', 'externally_verified')
  ),
  state text not null default 'proposed'
    check (state in ('proposed', 'confirmed', 'needs_review', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create index evidence_items_profile_idx
  on public.evidence_items (profile_id);

alter table public.evidence_items enable row level security;

create trigger evidence_items_set_updated_at
  before update on public.evidence_items
  for each row execute function public.set_updated_at();

-- `externally_verified` is RESERVED: users can never grant it to themselves;
-- only a future verification workflow (service_role) may set it.
create policy "owner can read own evidence"
  on public.evidence_items for select
  to authenticated
  using (
    exists (
      select 1 from public.candidate_profiles p
      where p.id = profile_id and p.user_id = (select auth.uid())
    )
  );

create policy "owner can add evidence with honest verification"
  on public.evidence_items for insert
  to authenticated
  with check (
    verification_status in ('imported', 'user_confirmed')
    and exists (
      select 1 from public.candidate_profiles p
      where p.id = profile_id and p.user_id = (select auth.uid())
    )
  );

create policy "owner can update own evidence with honest verification"
  on public.evidence_items for update
  to authenticated
  using (
    exists (
      select 1 from public.candidate_profiles p
      where p.id = profile_id and p.user_id = (select auth.uid())
    )
  )
  with check (
    verification_status in ('imported', 'user_confirmed')
    and exists (
      select 1 from public.candidate_profiles p
      where p.id = profile_id and p.user_id = (select auth.uid())
    )
  );

revoke all on public.evidence_items from anon, authenticated;
grant select, insert on public.evidence_items to authenticated;
grant update (
  type, title, statement, organization, start_date, end_date, metrics, tags,
  source_type, source_reference, verification_status, state, updated_at
) on public.evidence_items to authenticated;
grant select, insert, update, delete on public.evidence_items to service_role;

-- ---------------------------------------------------------------------------
-- 3. claim_evidence_links — explicit, traceable attachments.
--
-- Detaching NEVER deletes: it stamps detached_at (+ optional reason) so the
-- business history survives. Re-attaching creates a new row; at most one
-- ACTIVE link per (claim, evidence).

create table public.claim_evidence_links (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null
    references public.profile_claims (id) on delete cascade,
  evidence_id uuid not null
    references public.evidence_items (id) on delete cascade,
  created_at timestamptz not null default now(),
  detached_at timestamptz,
  detach_reason text check (char_length(detach_reason) <= 500),
  check (detach_reason is null or detached_at is not null)
);

create unique index claim_evidence_links_one_active
  on public.claim_evidence_links (claim_id, evidence_id)
  where detached_at is null;

create index claim_evidence_links_evidence_idx
  on public.claim_evidence_links (evidence_id);

alter table public.claim_evidence_links enable row level security;

-- Ownership flows through the claim's profile; inserting also requires the
-- evidence to belong to the SAME profile — no cross-profile stitching.
create policy "owner can read own links"
  on public.claim_evidence_links for select
  to authenticated
  using (
    exists (
      select 1
      from public.profile_claims c
      join public.candidate_profiles p on p.id = c.profile_id
      where c.id = claim_id and p.user_id = (select auth.uid())
    )
  );

create policy "owner can link own claim to own evidence"
  on public.claim_evidence_links for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profile_claims c
      join public.candidate_profiles p on p.id = c.profile_id
      join public.evidence_items e
        on e.id = evidence_id and e.profile_id = c.profile_id
      where c.id = claim_id and p.user_id = (select auth.uid())
    )
  );

create policy "owner can detach own links"
  on public.claim_evidence_links for update
  to authenticated
  using (
    exists (
      select 1
      from public.profile_claims c
      join public.candidate_profiles p on p.id = c.profile_id
      where c.id = claim_id and p.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.profile_claims c
      join public.candidate_profiles p on p.id = c.profile_id
      where c.id = claim_id and p.user_id = (select auth.uid())
    )
  );

revoke all on public.claim_evidence_links from anon, authenticated;
grant select, insert on public.claim_evidence_links to authenticated;
grant update (detached_at, detach_reason)
  on public.claim_evidence_links to authenticated;
grant select, insert, update, delete
  on public.claim_evidence_links to service_role;

-- ---------------------------------------------------------------------------
-- 4. profile_versions — immutable published snapshots.
--
-- `content` embeds the normalized confirmed claims AND the relevant evidence
-- fields; `content_hash` covers a canonical form that excludes visual order,
-- technical timestamps and meaningless ids (canonicalization lives in
-- src/lib/profile/ with reference-vector tests). Deliberately NO global
-- UNIQUE(profile_id, content_hash): only CONSECUTIVE versions must differ,
-- so an older content can be restored later. That rule is enforced
-- atomically by publish_profile_version() below.
--
-- Immutability vs right-to-erasure: no UPDATE grant for ANY role and no
-- direct INSERT/DELETE for users; service_role keeps DELETE strictly for the
-- future, documented privacy-erasure workflow (no absolute trigger that
-- would make account deletion impossible).

create table public.profile_versions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null
    references public.candidate_profiles (id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  change_summary text not null
    check (char_length(change_summary) between 1 and 2000),
  created_from_version_id uuid references public.profile_versions (id),
  published_at timestamptz not null default now(),
  unique (profile_id, version_number),
  -- Composite key so current_version_id below can be constrained to a
  -- version OF THE SAME PROFILE (defense in depth for privileged paths).
  unique (profile_id, id)
);

alter table public.profile_versions enable row level security;

create policy "owner can read own versions"
  on public.profile_versions for select
  to authenticated
  using (
    exists (
      select 1 from public.candidate_profiles p
      where p.id = profile_id and p.user_id = (select auth.uid())
    )
  );

revoke all on public.profile_versions from anon, authenticated;
grant select on public.profile_versions to authenticated;
grant select, insert, delete on public.profile_versions to service_role;
-- No UPDATE grant for anyone — versions never change after insertion.

-- ---------------------------------------------------------------------------
-- 5. candidate_profiles.current_version_id (single source of truth — no
--    duplicated version number). Maintained exclusively by
--    publish_profile_version(); the users' update grant stays display_name
--    only.

alter table public.candidate_profiles
  add column current_version_id uuid;

-- Same-profile constraint: even a privileged/manual update can never point a
-- profile at another profile's version.
alter table public.candidate_profiles
  add constraint candidate_profiles_current_version_same_profile
    foreign key (id, current_version_id)
    references public.profile_versions (profile_id, id)
    on delete set null (current_version_id);

-- ---------------------------------------------------------------------------
-- 6. Atomic publication (and restore) — SECURITY DEFINER, hardened.
--
-- Several independent statements from a Server Action cannot guarantee the
-- consecutive-difference rule under concurrency, so the whole contract runs
-- in ONE transaction here: lock profile row → read last version → compare
-- hash → next number → insert → move current_version_id.

create or replace function public.publish_profile_version(
  p_profile_id uuid,
  p_content jsonb,
  p_content_hash text,
  p_change_summary text,
  p_created_from_version_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_last record;
  v_next integer;
  v_id uuid;
  v_claim jsonb;
  v_ev jsonb;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  -- Ownership check + row lock: serializes concurrent publishes per profile.
  perform 1 from public.candidate_profiles
    where id = p_profile_id and user_id = v_uid
    for update;
  if not found then
    raise exception 'profile not found or not owned' using errcode = '42501';
  end if;

  if p_content is null or jsonb_typeof(p_content) <> 'object' then
    raise exception 'invalid content';
  end if;
  if pg_column_size(p_content) > 262144 then
    raise exception 'content too large';
  end if;

  -- Structural honesty validation: a snapshot is the durable, immutable
  -- record future phases will trust — the RPC boundary must refuse forged
  -- content even when the caller bypasses the app layer. In particular a
  -- user can NEVER smuggle an `externally_verified` badge into their own
  -- published history.
  if jsonb_typeof(p_content->'claims') <> 'array' then
    raise exception 'invalid content: claims must be an array';
  end if;
  if jsonb_array_length(p_content->'claims') > 500 then
    raise exception 'invalid content: too many claims';
  end if;
  for v_claim in
    select value from jsonb_array_elements(p_content->'claims')
  loop
    if coalesce(v_claim->>'kind', '') not in
       ('role', 'seniority', 'summary', 'years_experience', 'skill',
        'achievement') then
      raise exception 'invalid content: unknown claim kind';
    end if;
    if jsonb_typeof(v_claim->'value') <> 'object' then
      raise exception 'invalid content: claim value must be an object';
    end if;
    if v_claim ? 'evidence' then
      if jsonb_typeof(v_claim->'evidence') <> 'array' then
        raise exception 'invalid content: evidence must be an array';
      end if;
      for v_ev in
        select value from jsonb_array_elements(v_claim->'evidence')
      loop
        if coalesce(v_ev->>'verification_status', '') not in
           ('imported', 'user_confirmed') then
          raise exception
            'invalid content: forged or missing verification status';
        end if;
        if coalesce(v_ev->>'source_type', '') not in
           ('user_stated', 'document', 'url', 'import') then
          raise exception 'invalid content: unknown evidence source type';
        end if;
      end loop;
    end if;
  end loop;
  if p_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid content hash';
  end if;
  if p_change_summary is null
     or char_length(trim(p_change_summary)) not between 1 and 2000 then
    raise exception 'invalid change summary';
  end if;
  if p_created_from_version_id is not null then
    perform 1 from public.profile_versions
      where id = p_created_from_version_id and profile_id = p_profile_id;
    if not found then
      raise exception 'restore source version not found for this profile';
    end if;
  end if;

  select id, version_number, content_hash into v_last
    from public.profile_versions
    where profile_id = p_profile_id
    order by version_number desc
    limit 1;

  -- Consecutive-difference rule + double-submit idempotence: identical
  -- business content returns the existing head, creates nothing.
  if v_last.id is not null and v_last.content_hash = p_content_hash then
    return jsonb_build_object(
      'version_id', v_last.id,
      'version_number', v_last.version_number,
      'created', false
    );
  end if;

  v_next := coalesce(v_last.version_number, 0) + 1;

  insert into public.profile_versions
    (profile_id, version_number, content, content_hash, change_summary,
     created_from_version_id)
  values
    (p_profile_id, v_next, p_content, p_content_hash,
     trim(p_change_summary), p_created_from_version_id)
  returning id into v_id;

  update public.candidate_profiles
    set current_version_id = v_id
    where id = p_profile_id;

  return jsonb_build_object(
    'version_id', v_id,
    'version_number', v_next,
    'created', true
  );
end;
$$;

-- Restore = close the living claims, rebuild them from a snapshot, then
-- publish a NEW traceable version (never reactivates or mutates the old
-- one) — all in one transaction. Closed claims get a closure timestamp only
-- (no fake successor); links are re-attached only to evidence that still
-- exists, and misses are counted in the result, never silently dropped.
create or replace function public.restore_profile_version(
  p_profile_id uuid,
  p_version_id uuid,
  p_change_summary text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_source record;
  v_head record;
  v_claim jsonb;
  v_new_claim_id uuid;
  v_evidence_id uuid;
  v_missing integer := 0;
  v_result jsonb;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  perform 1 from public.candidate_profiles
    where id = p_profile_id and user_id = v_uid
    for update;
  if not found then
    raise exception 'profile not found or not owned' using errcode = '42501';
  end if;

  select id, version_number, content, content_hash into v_source
    from public.profile_versions
    where id = p_version_id and profile_id = p_profile_id;
  if not found then
    raise exception 'version not found for this profile';
  end if;

  -- Guard BEFORE any mutation: restoring a snapshot whose business content
  -- equals the current head would close/rebuild the living claims while the
  -- consecutive-difference rule prevents any traceable version row. Refuse
  -- the no-op instead of mutating silently.
  select content_hash, id, version_number into v_head
    from public.profile_versions
    where profile_id = p_profile_id
    order by version_number desc
    limit 1;
  if v_head.content_hash = v_source.content_hash then
    return jsonb_build_object(
      'version_id', v_head.id,
      'version_number', v_head.version_number,
      'created', false,
      'missing_evidence', 0
    );
  end if;

  update public.profile_claims
    set superseded_at = now()
    where profile_id = p_profile_id and superseded_at is null;

  for v_claim in
    select value
    from jsonb_array_elements(
      coalesce(v_source.content->'claims', '[]'::jsonb)
    )
  loop
    insert into public.profile_claims
      (profile_id, kind, value, state, origin)
    values
      (p_profile_id,
       v_claim->>'kind',
       coalesce(v_claim->'value', '{}'::jsonb),
       'confirmed',
       'user')
    returning id into v_new_claim_id;

    for v_evidence_id in
      select (e.value->>'evidence_id')::uuid
      from jsonb_array_elements(coalesce(v_claim->'evidence', '[]'::jsonb)) e
      where e.value->>'evidence_id' is not null
    loop
      if exists (
        select 1 from public.evidence_items
        where id = v_evidence_id and profile_id = p_profile_id
      ) then
        insert into public.claim_evidence_links (claim_id, evidence_id)
        values (v_new_claim_id, v_evidence_id);
      else
        v_missing := v_missing + 1;
      end if;
    end loop;
  end loop;

  v_result := public.publish_profile_version(
    p_profile_id,
    v_source.content,
    v_source.content_hash,
    p_change_summary,
    v_source.id
  );

  return v_result || jsonb_build_object('missing_evidence', v_missing);
end;
$$;

revoke all on function
  public.publish_profile_version(uuid, jsonb, text, text, uuid)
  from public, anon;
grant execute on function
  public.publish_profile_version(uuid, jsonb, text, text, uuid)
  to authenticated;

revoke all on function
  public.restore_profile_version(uuid, uuid, text)
  from public, anon;
grant execute on function
  public.restore_profile_version(uuid, uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Atomic claim replacement — SECURITY INVOKER (the caller's own RLS and
--    column grants apply inside), so supersede + insert cannot half-apply.

create or replace function public.replace_profile_claim(
  p_profile_id uuid,
  p_kind text,
  p_value jsonb,
  p_origin text default 'user',
  p_claim_to_supersede uuid default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old uuid;
  v_new uuid;
begin
  if p_claim_to_supersede is not null then
    -- The explicit target must be an ACTIVE claim of the SAME profile and
    -- SAME kind — never a foreign or mismatched chain reference (also avoids
    -- turning the insert into a cross-tenant claim-id existence oracle).
    select id into v_old
      from public.profile_claims
      where id = p_claim_to_supersede
        and profile_id = p_profile_id
        and kind = p_kind
        and superseded_at is null;
    if v_old is null then
      raise exception 'claim to supersede not found for this profile/kind';
    end if;
  elsif p_kind in ('role', 'seniority', 'summary', 'years_experience') then
    -- Auto-close applies to single-valued kinds only; multi-valued kinds
    -- (skill, achievement) require an explicit supersede target — never
    -- close an arbitrary sibling.
    select id into v_old
      from public.profile_claims
      where profile_id = p_profile_id
        and kind = p_kind
        and superseded_at is null
      order by created_at desc
      limit 1;
  end if;

  if v_old is not null then
    update public.profile_claims
      set superseded_by_claim_id = null,
          superseded_at = now()
      where id = v_old and superseded_at is null;
  end if;

  insert into public.profile_claims
    (profile_id, kind, value, state, origin, previous_claim_id)
  values
    (p_profile_id, p_kind, p_value, 'proposed', p_origin, v_old)
  returning id into v_new;

  if v_old is not null then
    update public.profile_claims
      set superseded_by_claim_id = v_new
      where id = v_old;
  end if;

  return v_new;
end;
$$;

revoke all on function
  public.replace_profile_claim(uuid, text, jsonb, text, uuid)
  from public, anon;
grant execute on function
  public.replace_profile_claim(uuid, text, jsonb, text, uuid)
  to authenticated;
