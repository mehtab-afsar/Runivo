-- ============================================================
-- P0-8: Harden the territories UPDATE policy
-- ============================================================
-- Two coexisting owner-UPDATE policies on the legacy `territories` table —
-- "territories: owner or service_role update" (20260301000028) and
-- "territories: owner can update own" (20260301000046) — neither carrying an
-- explicit WITH CHECK. Consolidate them into ONE policy with an explicit WITH CHECK
-- that pins owner_id, so an owner can never reassign a zone to another user (defence
-- in depth: we no longer rely on Postgres implicitly reusing USING as the check).
--
-- The client never updates this table directly (grep-confirmed; the live territory
-- model is territory_polygons, and the H3 `territories` model is orphaned — see
-- docs/CHANGES.md P2-5 to retire it). Server RPCs run SECURITY DEFINER / as
-- service_role and bypass RLS, so they are unaffected. Arbitrary defense/tier edits
-- on this dead table have no gameplay effect (nothing reads them) and are left to the
-- P2-5 retirement rather than a value-comparison trigger on an orphaned table.

DROP POLICY IF EXISTS "territories: owner or service_role update" ON public.territories;
DROP POLICY IF EXISTS "territories: owner can update own"         ON public.territories;

CREATE POLICY "territories: owner update with check"
  ON public.territories FOR UPDATE
  USING (auth.uid() = owner_id OR auth.role() = 'service_role')
  WITH CHECK (auth.uid() = owner_id OR auth.role() = 'service_role');
