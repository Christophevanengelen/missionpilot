-- Phase 1 / PR B — owner-authorized MINIMAL migration: explicit `role_played`
-- on evidence items ("rôle joué" is a first-class semantic field, never an
-- ambiguous metrics key). Strictly bounded to this need — no other model
-- change.

alter table public.evidence_items
  add column role_played text
    check (role_played is null
           or char_length(role_played) between 1 and 200);

-- The users' column-scoped update grant gains the new column (same honesty
-- policies as the other content columns — RLS unchanged).
grant update (role_played) on public.evidence_items to authenticated;

-- The canonical snapshot embeds role_played so a version freezes the role
-- alongside the rest of the evidence content. Same single shared
-- implementation, same ordering rule (the id-stripped record text).
create or replace function public.build_profile_snapshot(
  p_profile_id uuid
) returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'schema_version', 1,
    'claims', coalesce((
      select jsonb_agg(claim_obj order by claim_kind, claim_sort)
      from (
        select
          c.kind as claim_kind,
          c.value::text as claim_sort,
          jsonb_build_object(
            'kind', c.kind,
            'value', c.value,
            'evidence', coalesce((
              select jsonb_agg(ev_obj order by ev_sort)
              from (
                select
                  (jsonb_build_object(
                    'type', e.type,
                    'title', e.title,
                    'statement', e.statement,
                    'organization', e.organization,
                    'role_played', e.role_played,
                    'start_date', e.start_date,
                    'end_date', e.end_date,
                    'verification_status', e.verification_status,
                    'source_type', e.source_type,
                    'source_reference', e.source_reference
                  ))::text as ev_sort,
                  jsonb_build_object(
                    'evidence_id', e.id,
                    'type', e.type,
                    'title', e.title,
                    'statement', e.statement,
                    'organization', e.organization,
                    'role_played', e.role_played,
                    'start_date', e.start_date,
                    'end_date', e.end_date,
                    'verification_status', e.verification_status,
                    'source_type', e.source_type,
                    'source_reference', e.source_reference
                  ) as ev_obj
                from public.claim_evidence_links l
                join public.evidence_items e on e.id = l.evidence_id
                where l.claim_id = c.id
                  and l.detached_at is null
                  and e.state = 'confirmed'
              ) ev
            ), '[]'::jsonb)
          ) as claim_obj
        from public.profile_claims c
        where c.profile_id = p_profile_id
          and c.superseded_at is null
          and c.state = 'confirmed'
      ) cl
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.build_profile_snapshot(uuid)
  from public, anon, authenticated;
