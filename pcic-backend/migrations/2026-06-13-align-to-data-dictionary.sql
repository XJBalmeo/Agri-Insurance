-- Migration: align column types/sizes with the project Data Dictionary.
-- schema.sql drops and recreates tables (fresh installs only); this ALTER
-- resizes the columns of an existing, populated database in place.
--
-- ⚠️  Shrinking a column FAILS (or truncates) if any existing row already
--     holds a value longer than the new size. On a populated DB, check first:
--       SELECT MAX(CHAR_LENGTH(ProposerName)) FROM ProposerTable;  -- must be <= 30
--     and trim/migrate any over-long rows before running this.
--
-- Run with:
--   mysql -u root -p pcic_insurance < pcic-backend/migrations/2026-06-13-align-to-data-dictionary.sql

-- ---- Proposer ----------------------------------------------------------
ALTER TABLE ProposerTable
    MODIFY ProposerName       VARCHAR(30)  NOT NULL,
    MODIFY Address            VARCHAR(100) NOT NULL,
    MODIFY ContactNo          VARCHAR(15)  NOT NULL,
    MODIFY SecondaryContactNo VARCHAR(15)  NULL,
    MODIFY CivilStatus        CHAR(2)      NOT NULL,
    MODIFY Sex                CHAR(1)      NOT NULL,
    MODIFY Tribe              VARCHAR(20)  NULL,
    MODIFY Spouse             VARCHAR(30)  NULL;

-- ---- Farm --------------------------------------------------------------
-- SoilType/Topography/IrrigationType were SMALLER than the form allowed
-- (10/10/15 vs a 20-char input) — widening them also fixes the truncation
-- 500s on values like "Sandy Clay Loam" or "Gently Sloping".
ALTER TABLE FarmTable
    MODIFY PlantationName VARCHAR(20)  NOT NULL,
    MODIFY FarmAddress    VARCHAR(100) NOT NULL,
    MODIFY FarmArea       DECIMAL(5,2) NOT NULL,
    MODIFY SoilType       VARCHAR(20)  NOT NULL,
    MODIFY Topography     VARCHAR(20)  NOT NULL,
    MODIFY IrrigationType VARCHAR(20)  NOT NULL;

-- ---- Insurance ---------------------------------------------------------
ALTER TABLE InsuranceTable
    MODIFY Beneficiary        VARCHAR(30)   NOT NULL,
    MODIFY Crops              VARCHAR(20)   NOT NULL,
    MODIFY PlantationSize     DECIMAL(5,2)  NOT NULL,
    MODIFY DesiredAmountCover DECIMAL(10,2) NOT NULL;

-- ---- Variety -----------------------------------------------------------
ALTER TABLE VarietyTable
    MODIFY AreaPlanted DECIMAL(5,2) NOT NULL,
    MODIFY AgeGroup    VARCHAR(10)  NULL,
    MODIFY AvgYield    DECIMAL(5,1) NOT NULL DEFAULT 0;

-- ---- CPI materials / labor --------------------------------------------
ALTER TABLE CPIMaterialTable
    MODIFY MaterialItem VARCHAR(30)   NOT NULL,
    MODIFY MaterialCost DECIMAL(10,2) NOT NULL;

ALTER TABLE CPILaborTable
    MODIFY LaborWorkforce VARCHAR(30)   NOT NULL,
    MODIFY LaborCost      DECIMAL(10,2) NOT NULL;
