-- ======================================================
-- PCIC High Value Crop Insurance System
-- 3NF schema matching the INSERT statements in server.js.
-- Custom string PKs (P001 / F001 / INS001) match generateNextId().
-- CPI child tables hang off an AUTO_INCREMENT CPIID surrogate key
-- (server.js reads it via result.insertId after inserting a CPI row).
--
-- Column types/sizes follow the project Data Dictionary. The numeric
-- "size" in the dictionary is read as total digits (float 10 -> DECIMAL(10,2),
-- float 5 -> DECIMAL(5,2), integer 5 -> max 99999, enforced in validators.js).
--
-- Intentional deviations from the Data Dictionary (kept on purpose):
--   * CPIID / MaterialID / LaborID are INT AUTO_INCREMENT (dictionary: varchar)
--     so server.js can read result.insertId; VarietyTable gains a VarietyID PK
--     the dictionary lacks, so a single variety row can be deleted on its own.
--   * Money/area columns use DECIMAL (dictionary: float) to avoid float rounding.
--   * Birthday / CivilStatus / Sex are NOT NULL (dictionary leaves them blank)
--     because Birthday is half the proposer identity key and the form requires
--     all three.
--   * ApplicationStatus ENUM is a post-dictionary status-tracking feature.
-- ======================================================

CREATE DATABASE IF NOT EXISTS pcic_insurance
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pcic_insurance;

-- Drop in dependency order so the script is re-runnable.
DROP TABLE IF EXISTS CPILaborTable;
DROP TABLE IF EXISTS CPIMaterialTable;
DROP TABLE IF EXISTS CPITable;
DROP TABLE IF EXISTS VarietyTable;
DROP TABLE IF EXISTS InsuranceTable;
DROP TABLE IF EXISTS FarmTable;
DROP TABLE IF EXISTS ProposerTable;

-- ------------------------------------------------------
-- 1. PROPOSER
-- ------------------------------------------------------
CREATE TABLE ProposerTable (
    ProposerID          VARCHAR(10)  NOT NULL,
    ProposerName        VARCHAR(30)  NOT NULL,
    Address             VARCHAR(100) NOT NULL,
    Birthday            DATE         NOT NULL,
    ContactNo           VARCHAR(15)  NOT NULL,
    SecondaryContactNo  VARCHAR(15)  NULL,
    CivilStatus         CHAR(2)      NOT NULL,
    Sex                 CHAR(1)      NOT NULL,
    IP                  TINYINT(1)   NOT NULL DEFAULT 0,
    Tribe               VARCHAR(20)  NULL,
    Spouse              VARCHAR(30)  NULL,
    SpouseBirthday      DATE         NULL,
    PRIMARY KEY (ProposerID)
) ENGINE=InnoDB;

-- ------------------------------------------------------
-- 2. FARM
-- ------------------------------------------------------
CREATE TABLE FarmTable (
    PlantationID    VARCHAR(10)    NOT NULL,
    PlantationName  VARCHAR(20)    NOT NULL,
    FarmAddress     VARCHAR(100)   NOT NULL,
    FarmArea        DECIMAL(5,2)   NOT NULL,
    SoilType        VARCHAR(20)    NOT NULL,
    SoilPH          DECIMAL(3,1)   NOT NULL,
    Topography      VARCHAR(20)    NOT NULL,
    IrrigationType  VARCHAR(20)    NOT NULL,
    PRIMARY KEY (PlantationID)
) ENGINE=InnoDB;

-- ------------------------------------------------------
-- 3. INSURANCE
-- ------------------------------------------------------
CREATE TABLE InsuranceTable (
    InsuranceID         VARCHAR(10)    NOT NULL,
    ProposerID          VARCHAR(10)    NOT NULL,
    Beneficiary         VARCHAR(30)    NOT NULL,
    Crops               VARCHAR(20)    NOT NULL,
    PlantationSize      DECIMAL(5,2)   NOT NULL,
    CoverageStart       DATE           NOT NULL,
    CoverageEnd         DATE           NOT NULL,
    Flood               TINYINT(1)     NOT NULL DEFAULT 0,
    Typhoon             TINYINT(1)     NOT NULL DEFAULT 0,
    Drought             TINYINT(1)     NOT NULL DEFAULT 0,
    Pests               TINYINT(1)     NOT NULL DEFAULT 0,
    DesiredAmountCover  DECIMAL(10,2)  NOT NULL,
    PlantationID        VARCHAR(10)    NOT NULL,
    SupervisingPT       VARCHAR(30)    NOT NULL,
    PTDate              DATE           NOT NULL,
    ProposerDate        DATE           NULL,
    -- ENUM means MySQL itself rejects any value outside the three
    -- statuses; new applications start as 'Pending' via the DEFAULT.
    ApplicationStatus   ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
    PRIMARY KEY (InsuranceID),
    CONSTRAINT fk_insurance_proposer  FOREIGN KEY (ProposerID)   REFERENCES ProposerTable(ProposerID),
    CONSTRAINT fk_insurance_plantation FOREIGN KEY (PlantationID) REFERENCES FarmTable(PlantationID)
) ENGINE=InnoDB;

-- ------------------------------------------------------
-- 4. VARIETY (multiple per insurance)
-- ------------------------------------------------------
CREATE TABLE VarietyTable (
    VarietyID       INT            NOT NULL AUTO_INCREMENT,
    InsuranceID     VARCHAR(10)    NOT NULL,
    Variety         VARCHAR(20)    NOT NULL,
    AreaPlanted     DECIMAL(5,2)   NOT NULL,
    DatePlanting    DATE           NOT NULL,
    EstHarvestDate  DATE           NOT NULL,
    AgeGroup        VARCHAR(10)    NULL,
    NumTrees        INT            NOT NULL DEFAULT 0,
    AvgYield        DECIMAL(5,1)   NOT NULL DEFAULT 0,
    PRIMARY KEY (VarietyID),
    CONSTRAINT fk_variety_insurance FOREIGN KEY (InsuranceID) REFERENCES InsuranceTable(InsuranceID)
) ENGINE=InnoDB;

-- ------------------------------------------------------
-- 5. CPI SCHEDULE (one row per days-after-planting block)
-- CPIID is the surrogate PK that materials/labor reference;
-- the UNIQUE key still guarantees one block per day per policy.
-- ------------------------------------------------------
CREATE TABLE CPITable (
    CPIID               INT          NOT NULL AUTO_INCREMENT,
    InsuranceID         VARCHAR(10)  NOT NULL,
    DaysNoAfterPlanting INT          NOT NULL,
    PRIMARY KEY (CPIID),
    UNIQUE KEY uq_cpi_insurance_day (InsuranceID, DaysNoAfterPlanting),
    CONSTRAINT fk_cpi_insurance FOREIGN KEY (InsuranceID) REFERENCES InsuranceTable(InsuranceID)
) ENGINE=InnoDB;

-- ------------------------------------------------------
-- 6. CPI MATERIALS
-- ------------------------------------------------------
CREATE TABLE CPIMaterialTable (
    MaterialID          INT            NOT NULL AUTO_INCREMENT,
    CPIID               INT            NOT NULL,
    MaterialItem        VARCHAR(30)    NOT NULL,
    MaterialQuantity    INT            NOT NULL,
    MaterialCost        DECIMAL(10,2)  NOT NULL,
    PRIMARY KEY (MaterialID),
    CONSTRAINT fk_material_cpi FOREIGN KEY (CPIID) REFERENCES CPITable(CPIID)
) ENGINE=InnoDB;

-- ------------------------------------------------------
-- 7. CPI LABOR
-- ------------------------------------------------------
CREATE TABLE CPILaborTable (
    LaborID             INT            NOT NULL AUTO_INCREMENT,
    CPIID               INT            NOT NULL,
    LaborWorkforce      VARCHAR(30)    NOT NULL,
    LaborQuantity       INT            NOT NULL,
    LaborCost           DECIMAL(10,2)  NOT NULL,
    PRIMARY KEY (LaborID),
    CONSTRAINT fk_labor_cpi FOREIGN KEY (CPIID) REFERENCES CPITable(CPIID)
) ENGINE=InnoDB;
