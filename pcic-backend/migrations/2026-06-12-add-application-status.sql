-- Migration: add ApplicationStatus to InsuranceTable (Phase 5 status tracking).
-- schema.sql drops and recreates tables, so it is only for fresh installs;
-- this ALTER updates an existing database in place without losing data.
-- Existing rows get the DEFAULT ('Pending') automatically.
--
-- Run with:
--   mysql -u root -p pcic_insurance < pcic-backend/migrations/2026-06-12-add-application-status.sql

ALTER TABLE InsuranceTable
    ADD COLUMN ApplicationStatus ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending'
    AFTER ProposerDate;
