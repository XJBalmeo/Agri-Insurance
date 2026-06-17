-- Migration: give VarietyTable a UNIQUE (InsuranceID, Variety) key.
-- VarietyTable has no surrogate primary key, so a single variety row could
-- only be reached via its parent InsuranceID. Admins now need to delete/edit
-- ONE variety by row, which means addressing it by (InsuranceID, Variety).
-- This UNIQUE constraint guarantees that pair identifies exactly one row (and,
-- as a bonus, indexes it so the composite WHERE lookups stay fast).
--
-- ⚠️  This FAILS with ER_DUP_ENTRY if the table already holds two rows with the
--     same InsuranceID + Variety. On a populated DB, check first:
--       SELECT InsuranceID, Variety, COUNT(*) c
--       FROM VarietyTable GROUP BY InsuranceID, Variety HAVING c > 1;
--     and de-duplicate any rows it returns before running this.
--
-- Run with:
--   mysql -u root -p pcic_insurance < pcic-backend/migrations/2026-06-17-variety-unique-key.sql

ALTER TABLE VarietyTable
    ADD CONSTRAINT uq_variety_insurance UNIQUE (InsuranceID, Variety);
